import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CodexRunError } from "../../bridge/codex-runner.mjs";
import { createBridgeConfig } from "../../bridge/config.mjs";
import { RunStore } from "../../bridge/run-store.mjs";
import { TaskManager } from "../../bridge/task-manager.mjs";
import { WorkspaceManager } from "../../bridge/workspace-manager.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const contentInput = {
  contentId: "content-task-manager",
  taskType: "content",
  contentVersion: 1,
  instruction: "",
  creatorContext: {},
  contentBrief: {},
  confirmedContent: null,
  styleConfig: null
};

async function createManager(runner) {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-manager-"));
  const config = createBridgeConfig({
    projectRoot,
    dataRoot: path.join(root, ".data"),
    workRoot: path.join(root, "work")
  });
  const store = new RunStore(config);
  const workspaceManager = new WorkspaceManager(config);
  const manager = new TaskManager({ config, store, workspaceManager, runner });
  await manager.initialize();
  return manager;
}

test("task manager cancels active tasks and persists the terminal status", async () => {
  let markStarted;
  const runnerStarted = new Promise((resolve) => { markStarted = resolve; });
  const runner = (options) => new Promise((resolve, reject) => {
    options.onEvent?.({ type: "thread.started", thread_id: "thread-cancel-manager" });
    markStarted();
    options.signal.addEventListener("abort", () => reject(new CodexRunError("cancelled", {
      reason: "cancelled",
      threadId: "thread-cancel-manager"
    })), { once: true });
  });
  const manager = await createManager(runner);
  const created = await manager.createRun(contentInput);
  await runnerStarted;
  await assert.rejects(
    manager.createRun({ ...contentInput, contentId: "content-second" }),
    /already running/
  );
  const cancelled = await manager.cancelRun(created.runId);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.threadId, "thread-cancel-manager");
  assert.equal(cancelled.error.code, "RUN_CANCELLED");
  const events = await manager.store.readEvents(created.runId);
  assert.equal(events.at(-1).type, "bridge.run.cancelled");
});

test("task manager distinguishes timeout from a generic failure", async () => {
  const runner = async () => {
    throw new CodexRunError("timed out", { reason: "timeout", threadId: "thread-timeout-manager" });
  };
  const manager = await createManager(runner);
  const created = await manager.createRun(contentInput);
  let record;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    record = manager.get(created.runId);
    if (record.status === "timeout") break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(record.status, "timeout");
  assert.equal(record.error.code, "RUN_TIMEOUT");
});
