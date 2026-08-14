import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { AssetStore } from "../bridge/asset-store.mjs";
import { createBridgeConfig } from "../bridge/config.mjs";
import { RunStore } from "../bridge/run-store.mjs";
import { TaskManager } from "../bridge/task-manager.mjs";
import { WorkspaceManager } from "../bridge/workspace-manager.mjs";
import { validateVideoPlanSemantics } from "../bridge/video-plan-validator.mjs";

const args = process.argv.slice(2);
if (args.includes("--help") || args.length === 0) {
  console.log("用法：npm run smoke:video -- <plan|render|cancel> --yes\n真实视频冒烟测试必须显式添加 --yes；render 和 cancel 会启动本机 Remotion。");
  process.exit(0);
}
const mode = args.find((value) => !value.startsWith("--"));
if (!["plan", "render", "cancel"].includes(mode)) {
  console.error("范围必须是 plan、render 或 cancel。");
  process.exit(2);
}
if (!args.includes("--yes")) {
  console.error("尚未执行：真实视频冒烟测试必须显式添加 --yes。");
  process.exit(2);
}

const scenePlan = await import("../video-renderer/fixtures/sample-scene-plan.json", { with: { type: "json" } }).then((module) => module.default);
validateVideoPlanSemantics(scenePlan);
if (mode === "plan") {
  console.log(`Plan smoke passed: ${scenePlan.scenes.length} scenes, ${scenePlan.durationInFrames / scenePlan.fps}s, ${scenePlan.width}x${scenePlan.height}`);
  process.exit(0);
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "content-workstation-render-"));
const config = createBridgeConfig({ projectRoot, dataRoot: path.join(temporaryRoot, ".data"), workRoot: path.join(temporaryRoot, "work") });
const assetStore = new AssetStore(config);
await assetStore.initialize();
const store = new RunStore(config);
const workspaceManager = new WorkspaceManager(config, { assetStore });
const manager = new TaskManager({ config, store, workspaceManager });
await manager.initialize();
const run = await manager.createRun({ contentId: "video-render-smoke", taskType: "video-render", contentVersion: 1, instruction: "", scenePlan, assetIds: [], audioAssetId: "", captionsAssetId: "" });

let terminal = run;
let cancellationRequested = false;
for (let attempt = 0; attempt < 1200; attempt += 1) {
  terminal = manager.get(run.runId);
  process.stdout.write(`\r${terminal.phase || terminal.status} ${terminal.progress || 0}%`);
  if (!["queued", "running"].includes(terminal.status)) break;
  if (mode === "cancel" && terminal.phase === "rendering" && !cancellationRequested) {
    cancellationRequested = true;
    terminal = await manager.cancelRun(run.runId);
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
process.stdout.write("\n");
if (mode === "cancel") {
  if (terminal.status !== "cancelled") throw new Error(`Cancel smoke ended with ${terminal.status}`);
  console.log("Cancel smoke passed: active Remotion render stopped and persisted as cancelled");
  process.exit(0);
}
if (terminal.status !== "completed") throw new Error(terminal.error?.message || `Render ended with ${terminal.status}`);
const video = terminal.artifactManifest.artifacts.find((artifact) => artifact.type === "video-mp4");
const poster = terminal.artifactManifest.artifacts.find((artifact) => artifact.type === "video-poster");
if (!video || !poster) throw new Error("Validated render is missing MP4 or poster");
console.log(`Render smoke passed: ${terminal.artifactManifest.durationSeconds.toFixed(2)}s, ${video.width}x${video.height}, ${(video.size / 1024 / 1024).toFixed(2)}MB`);
