import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createBridgeConfig } from "../bridge/config.mjs";
import { runCodex } from "../bridge/codex-runner.mjs";
import { createTaskSpecification, finalizeTaskResult } from "../bridge/task-definition.mjs";
import { WorkspaceManager } from "../bridge/workspace-manager.mjs";

const requestedTask = process.argv[2];
if (!["publishing", "video-plan"].includes(requestedTask)) {
  throw new Error("Usage: node scripts/smoke-codex-workstation-tasks.mjs [publishing|video-plan]");
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const smokeRoot = path.join(projectRoot, "work/m3-plugin-smoke");
await mkdir(smokeRoot, { recursive: true });
const config = createBridgeConfig({ projectRoot, workRoot: path.join(smokeRoot, "work"), dataRoot: path.join(smokeRoot, ".data") });
const manager = new WorkspaceManager(config);
await manager.initialize();
const confirmedContent = await readFile(path.join(projectRoot, "tests/fixtures/a1/confirmed-content.md"), "utf8");
const input = requestedTask === "publishing" ? {
  contentId: "m3-publishing-smoke",
  taskType: "publishing",
  contentVersion: 1,
  instruction: "只为 B站 生成可发布文案，不得增加其他平台。",
  confirmedContent,
  styleConfig: { platforms: ["B站"], acceptedHtmlRunId: "", acceptedCoverRunId: "" }
} : {
  contentId: "m3-video-plan-smoke",
  taskType: "video-plan",
  contentVersion: 1,
  instruction: "生成 30 秒横版技术验证方案。",
  confirmedContent,
  styleConfig: { sourceMode: "direct-content", aspectRatio: "16:9", durationInFrames: 900 }
};

const workspace = await manager.create(`run-${randomUUID()}`, input);
const specification = createTaskSpecification(input, workspace, config.taskTimeoutMs[requestedTask]);
let eventCount = 0;
const result = await runCodex({
  ...specification,
  cwd: workspace,
  ephemeral: false,
  onEvent: () => { eventCount += 1; }
});
const manifest = await finalizeTaskResult(input, workspace, result.structuredResult);

if (requestedTask === "publishing") {
  if (manifest.taskType !== "publishing" || manifest.artifacts[0]?.type !== "publishing-package") throw new Error("Publishing manifest is invalid");
} else if (manifest.taskType !== "video-plan" || manifest.artifacts[0]?.type !== "video-scene-plan-json") {
  throw new Error("Video-plan manifest is invalid");
}

process.stdout.write(`${JSON.stringify({ ok: true, taskType: requestedTask, threadId: result.threadId, eventCount, workspace, manifest }, null, 2)}\n`);
