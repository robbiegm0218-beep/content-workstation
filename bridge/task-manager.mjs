import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { runCodex, CodexRunError } from "./codex-runner.mjs";
import { HttpError, createMinimalCodexEnvironment } from "./security.mjs";
import { TERMINAL_RUN_STATUSES } from "./config.mjs";
import { createTaskSpecification, finalizeTaskResult } from "./task-definition.mjs";
import { runVideoRender } from "./video-render-runner.mjs";
import { validateVideoRenderManifest } from "./video-render-validator.mjs";

export class TaskManager {
  constructor({ config, store, workspaceManager, runner = runCodex, videoRenderer = runVideoRender, videoRenderValidator = validateVideoRenderManifest }) {
    this.config = config;
    this.store = store;
    this.workspaceManager = workspaceManager;
    this.runner = runner;
    this.videoRenderer = videoRenderer;
    this.videoRenderValidator = videoRenderValidator;
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
      artifactManifest: null,
      progress: 0,
      phase: "queued"
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
      styleConfig: null,
      acceptedHtml: null
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
      artifactManifest: null,
      progress: 0,
      phase: "queued"
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

  async resumeVideoRender(runId) {
    if (this.active.size >= this.config.maxConcurrentRuns) throw new HttpError(409, "RUN_LIMIT_REACHED", "Another task is already running");
    const previous = this.get(runId);
    if (!previous) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found");
    if (previous.taskType !== "video-render") throw new HttpError(409, "RUN_NOT_RESUMABLE", "Only video renders can resume from checkpoints");
    if (!new Set(["failed", "cancelled", "timeout", "interrupted"]).has(previous.status)) throw new HttpError(409, "RUN_NOT_RESUMABLE", "Only an unfinished video render can resume");
    const input = await this.workspaceManager.readInput(previous);
    const queued = await this.store.update(runId, {status: "queued", startedAt: null, completedAt: null, error: null, artifactManifest: null, progress: 0, phase: "queued", segmentIndex: 0, segmentCount: 0});
    await this.#publish(runId, "bridge.run.resumed", {});
    const controller = new AbortController();
    const activeRun = {controller, promise: null};
    activeRun.promise = this.#execute(input, queued, controller.signal).finally(() => this.active.delete(runId));
    this.active.set(runId, activeRun);
    activeRun.promise.catch(() => {});
    return this.store.get(runId);
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

    const specification = input.taskType === "video-render" ? null : createTaskSpecification(input, initialRecord.workspace, this.config.taskTimeoutMs[input.taskType]);
    if (continuation) {
      if (input.taskType === "video-render") throw new HttpError(409, "RUN_NOT_CONTINUABLE", "Video renders cannot continue; retry after changing inputs");
      specification.prompt = [
        `继续之前的 ${input.taskType} 任务。`,
        `本次修改要求文件：${continuation.continuationPath}`,
        "只修改当前任务类型的产物，保持未提及内容不变。",
        "重新写入产物与 manifest，最终只返回符合原 Schema 的 JSON。"
      ].join("\n");
    }
    const eventWrites = [];
    let lastRenderPercent = -1;

    try {
      if (abortSignal.aborted) {
        throw new CodexRunError("Codex run was cancelled before Runner start", { reason: "cancelled" });
      }
      const eventHandler = (event) => {
        const write = this.#publish(runId, input.taskType === "video-render" ? "render.event" : "codex.event", { event });
        eventWrites.push(write);
        if (input.taskType === "video-render") {
          const progress = event.type === "render.progress" ? Math.round(Number(event.progress || 0) * 100) : event.type === "bundle.progress" ? Math.min(15, Math.round(Number(event.progress || 0) * 15)) : null;
          const phase = event.type === "bundle.progress" ? "bundling" : event.type === "render.progress" ? "rendering" : event.type === "render.completed" ? "validating" : null;
          if (progress !== null && (progress >= lastRenderPercent + 2 || progress === 100)) {
            lastRenderPercent = progress;
            eventWrites.push(this.store.update(runId, { progress, phase }));
          }
          if (event.type === "render.segment.started" || event.type === "render.segment.reused") {
            eventWrites.push(this.store.update(runId, {phase: "rendering", segmentIndex: event.index, segmentCount: event.count}));
          }
          if (event.type === "render.merging") eventWrites.push(this.store.update(runId, {phase: "merging", segmentIndex: event.count, segmentCount: event.count}));
        }
      };
      const result = input.taskType === "video-render"
        ? { threadId: null, structuredResult: await this.videoRenderer({ workspace: initialRecord.workspace, projectRoot: this.config.projectRoot, signal: abortSignal, timeoutMs: this.config.taskTimeoutMs["video-render"], onEvent: eventHandler }) }
        : await this.runner({
          ...specification,
          cwd: initialRecord.workspace,
          ephemeral: false,
          signal: abortSignal,
          resumeThreadId: continuation?.resumeThreadId ?? null,
          env: createMinimalCodexEnvironment(),
          onEvent: eventHandler
        });
      await Promise.all(eventWrites);
      const artifactManifest = input.taskType === "video-render"
        ? await this.videoRenderValidator(initialRecord.workspace, result.structuredResult)
        : await finalizeTaskResult(input, initialRecord.workspace, result.structuredResult);
      const completed = await this.store.update(runId, {
        status: "completed",
        threadId: result.threadId,
        completedAt: new Date().toISOString(),
        artifactManifest,
        progress: 100,
        phase: "completed",
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
