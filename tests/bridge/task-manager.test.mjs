import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CodexRunError } from "../../bridge/codex-runner.mjs";
import { AssetStore } from "../../bridge/asset-store.mjs";
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

async function createManager(runner, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-manager-"));
  const config = createBridgeConfig({
    projectRoot,
    dataRoot: path.join(root, ".data"),
    workRoot: path.join(root, "work")
  });
  const store = new RunStore(config);
  const assetStore = new AssetStore(config);
  await assetStore.initialize();
  const workspaceManager = new WorkspaceManager(config, { assetStore });
  const manager = new TaskManager({ config, store, workspaceManager, runner, ...options });
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

test("fake video renderer reports progress and completes without Codex or a browser", async () => {
  const scenePlan = JSON.parse(await readFile(path.resolve(projectRoot, "video-renderer/fixtures/sample-scene-plan.json"), "utf8"));
  let codexCalled = false;
  const manager = await createManager(async () => { codexCalled = true; throw new Error("Codex must not run"); }, {
    videoRenderer: async ({ onEvent }) => {
      onEvent({ type: "bundle.progress", progress: 1 });
      onEvent({ type: "render.progress", progress: 0.5 });
      return { taskType: "video-render", artifacts: [] };
    },
    videoRenderValidator: async (_workspace, manifest) => ({ ...manifest, validated: true }),
  });
  const created = await manager.createRun({ contentId: "video-fake", taskType: "video-render", contentVersion: 1, instruction: "", scenePlan, assetIds: [], audioAssetId: "", captionsAssetId: "" });
  let record;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    record = manager.get(created.runId);
    if (record.status === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(record.status, "completed", record.error?.message);
  assert.equal(record.progress, 100);
  assert.equal(record.artifactManifest.validated, true);
  assert.equal(codexCalled, false);
  const events = await manager.store.readEvents(created.runId);
  assert.ok(events.some((event) => event.type === "render.event" && event.event.type === "render.progress"));
});

test("fake video renderer can be cancelled and records terminal state", async () => {
  const scenePlan = JSON.parse(await readFile(path.resolve(projectRoot, "video-renderer/fixtures/sample-scene-plan.json"), "utf8"));
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const manager = await createManager(async () => ({}), {
    videoRenderer: ({ signal }) => new Promise((_resolve, reject) => {
      started();
      signal.addEventListener("abort", () => reject(new CodexRunError("cancelled render", { reason: "cancelled" })), { once: true });
    }),
    videoRenderValidator: async () => { throw new Error("cancelled render must not validate"); },
  });
  const created = await manager.createRun({ contentId: "video-cancel", taskType: "video-render", contentVersion: 1, instruction: "", scenePlan, assetIds: [], audioAssetId: "", captionsAssetId: "" });
  await ready;
  const cancelled = await manager.cancelRun(created.runId);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.error.code, "RUN_CANCELLED");
});

test("an unfinished video render resumes in the same workspace and run", async () => {
  const scenePlan = JSON.parse(await readFile(path.resolve(projectRoot, "video-renderer/fixtures/sample-scene-plan.json"), "utf8"));
  let attempts = 0;
  const manager = await createManager(async () => ({}), {
    videoRenderer: async ({onEvent}) => {
      attempts += 1;
      onEvent({type: "render.segment.started", index: attempts, count: 2});
      if (attempts === 1) throw new CodexRunError("stopped after checkpoint", {reason: "cancelled"});
      onEvent({type: "render.segment.reused", index: 1, count: 2});
      onEvent({type: "render.progress", progress: 1});
      return {taskType: "video-render", artifacts: []};
    },
    videoRenderValidator: async (_workspace, manifest) => ({...manifest, validated: true}),
  });
  const created = await manager.createRun({contentId: "video-resume", taskType: "video-render", contentVersion: 1, instruction: "", scenePlan, assetIds: [], audioAssetId: "", captionsAssetId: ""});
  for (let attempt = 0; attempt < 100 && manager.get(created.runId).status !== "cancelled"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  const workspace = manager.get(created.runId).workspace;
  const resumed = await manager.resumeVideoRender(created.runId);
  assert.equal(resumed.runId, created.runId);
  for (let attempt = 0; attempt < 100 && manager.get(created.runId).status !== "completed"; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  const completed = manager.get(created.runId);
  assert.equal(completed.status, "completed", completed.error?.message);
  assert.equal(completed.workspace, workspace);
  assert.equal(attempts, 2);
  const events = await manager.store.readEvents(created.runId);
  assert.ok(events.some((event) => event.type === "bridge.run.resumed"));
  assert.ok(events.some((event) => event.type === "render.event" && event.event.type === "render.segment.reused"));
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
