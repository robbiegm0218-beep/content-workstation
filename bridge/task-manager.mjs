import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { runCodex, CodexRunError } from "./codex-runner.mjs";
import { HttpError, createMinimalCodexEnvironment } from "./security.mjs";
import { TERMINAL_RUN_STATUSES } from "./config.mjs";
import { createTaskSpecification, finalizeTaskResult } from "./task-definition.mjs";

export class TaskManager {
  constructor({ config, store, workspaceManager, runner = runCodex }) {
    this.config = config;
    this.store = store;
    this.workspaceManager = workspaceManager;
    this.runner = runner;
    this.active = new Map();
    this.listeners = new Map();
  }

  get activeCount() {
    return this.active.size;
  }

  async initialize() {
    await this.workspaceManager.initialize();
    await this.store.initialize();
  }

  get(runId) {
    return this.store.get(runId);
  }

  list() {
    return this.store.list();
  }

  async shutdown() {
    const runs = [...this.active.values()];
    for (const activeRun of runs) activeRun.controller.abort();
    await Promise.allSettled(runs.map((activeRun) => activeRun.promise));
  }

  async createRun(input) {
    if (this.active.size >= this.config.maxConcurrentRuns) {
      throw new HttpError(409, "RUN_LIMIT_REACHED", "Another Codex task is already running");
    }

    const runId = `run-${randomUUID()}`;
    const workspace = await this.workspaceManager.create(runId, input);
    const now = new Date().toISOString();
    const record = {
      runId,
      contentId: input.contentId,
      taskType: input.taskType,
      contentVersion: input.contentVersion,
      status: "queued",
      threadId: null,
      inputSnapshotHash: createHash("sha256").update(JSON.stringify(input)).digest("hex"),
      workspace,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      artifactManifest: null
    };
    await this.store.create(record);

    const controller = new AbortController();
    const activeRun = { controller, promise: null };
    activeRun.promise = this.#execute(input, record, controller.signal)
      .finally(() => this.active.delete(runId));
    this.active.set(runId, activeRun);
    activeRun.promise.catch(() => {});
    return this.store.get(runId);
  }

  async continueRun(parentRunId, { instruction }) {
    if (this.active.size >= this.config.maxConcurrentRuns) {
      throw new HttpError(409, "RUN_LIMIT_REACHED", "Another Codex task is already running");
    }
    const parent = this.get(parentRunId);
    if (!parent) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found");
    if (parent.status !== "completed" || !parent.threadId) {
      throw new HttpError(409, "RUN_NOT_CONTINUABLE", "Only a completed run with a thread ID can continue");
    }

    const runId = `run-${randomUUID()}`;
    const now = new Date().toISOString();
    const continuationPath = path.join(parent.workspace, "input", `continuation-${runId}.json`);
    await writeFile(continuationPath, `${JSON.stringify({ runId, parentRunId, instruction, createdAt: now }, null, 2)}\n`, { mode: 0o600 });
    const input = {
      contentId: parent.contentId,
      taskType: parent.taskType,
      contentVersion: parent.contentVersion,
      instruction,
      creatorContext: null,
      contentBrief: null,
      confirmedContent: null,
      styleConfig: null
    };
    const record = {
      runId,
      parentRunId,
      contentId: parent.contentId,
      taskType: parent.taskType,
      contentVersion: parent.contentVersion,
      status: "queued",
      threadId: parent.threadId,
      inputSnapshotHash: createHash("sha256").update(instruction).digest("hex"),
      workspace: parent.workspace,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      error: null,
      artifactManifest: null
    };
    await this.store.create(record);

    const controller = new AbortController();
    const activeRun = { controller, promise: null };
    activeRun.promise = this.#execute(input, record, controller.signal, {
      resumeThreadId: parent.threadId,
      continuationPath
    }).finally(() => this.active.delete(runId));
    this.active.set(runId, activeRun);
    activeRun.promise.catch(() => {});
    return this.store.get(runId);
  }

  async cancelRun(runId) {
    const record = this.get(runId);
    if (!record) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found");
    const activeRun = this.active.get(runId);
    if (!activeRun) return record;
    activeRun.controller.abort();
    await activeRun.promise;
    return this.get(runId);
  }

  async retryRun(parentRunId) {
    if (this.active.size >= this.config.maxConcurrentRuns) {
      throw new HttpError(409, "RUN_LIMIT_REACHED", "Another Codex task is already running");
    }
    const parent = this.get(parentRunId);
    if (!parent) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found");
    if (!TERMINAL_RUN_STATUSES.has(parent.status)) {
      throw new HttpError(409, "RUN_NOT_RETRYABLE", "Only a finished task can be retried");
    }
    const input = await this.workspaceManager.readInput(parent);
    return this.createRun(input);
  }

  async subscribe(runId, listener) {
    if (!this.get(runId)) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found");
    const historical = await this.store.readEvents(runId);
    for (const event of historical) listener(event);
    const listeners = this.listeners.get(runId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(runId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(runId);
    };
  }

  async #publish(runId, type, payload = {}) {
    const event = { type, runId, timestamp: new Date().toISOString(), ...payload };
    await this.store.appendEvent(runId, event);
    for (const listener of this.listeners.get(runId) ?? []) listener(event);
  }

  async #execute(input, initialRecord, abortSignal, continuation = null) {
    const runId = initialRecord.runId;
    const startedAt = new Date().toISOString();
    await this.store.update(runId, { status: "running", startedAt });
    await this.#publish(runId, "bridge.run.started", { taskType: input.taskType });

    const specification = createTaskSpecification(
      input,
      initialRecord.workspace,
      this.config.taskTimeoutMs[input.taskType]
    );
    if (continuation) {
      specification.prompt = [
        `继续之前的 ${input.taskType} 任务。`,
        `本次修改要求文件：${continuation.continuationPath}`,
        "只修改当前任务类型的产物，保持未提及内容不变。",
        "重新写入产物与 manifest，最终只返回符合原 Schema 的 JSON。"
      ].join("\n");
    }
    const eventWrites = [];

    try {
      if (abortSignal.aborted) {
        throw new CodexRunError("Codex run was cancelled before Runner start", { reason: "cancelled" });
      }
      const result = await this.runner({
        ...specification,
        cwd: initialRecord.workspace,
        ephemeral: false,
        signal: abortSignal,
        resumeThreadId: continuation?.resumeThreadId ?? null,
        env: createMinimalCodexEnvironment(),
        onEvent: (event) => {
          const write = this.#publish(runId, "codex.event", { event });
          eventWrites.push(write);
        }
      });
      await Promise.all(eventWrites);
      const artifactManifest = await finalizeTaskResult(
        input,
        initialRecord.workspace,
        result.structuredResult
      );
      const completed = await this.store.update(runId, {
        status: "completed",
        threadId: result.threadId,
        completedAt: new Date().toISOString(),
        artifactManifest,
        error: null
      });
      await this.#publish(runId, "bridge.run.completed", { artifactManifest });
      return completed;
    } catch (error) {
      await Promise.allSettled(eventWrites);
      const status = error instanceof CodexRunError && error.reason === "cancelled"
        ? "cancelled"
        : error instanceof CodexRunError && error.reason === "timeout"
          ? "timeout"
          : "failed";
      const failed = await this.store.update(runId, {
        status,
        threadId: error.threadId ?? this.store.get(runId)?.threadId ?? null,
        completedAt: new Date().toISOString(),
        error: {
          code: status === "cancelled" ? "RUN_CANCELLED" : status === "timeout" ? "RUN_TIMEOUT" : "RUN_FAILED",
          message: error.message
        }
      });
      await this.#publish(runId, `bridge.run.${status}`, { error: failed.error });
      return failed;
    }
  }
}
