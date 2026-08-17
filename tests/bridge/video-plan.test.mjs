import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBridgeConfig } from "../../bridge/config.mjs";
import { createTaskSpecification, finalizeTaskResult } from "../../bridge/task-definition.mjs";
import { WorkspaceManager } from "../../bridge/workspace-manager.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../..");

test("video-plan workspace snapshots accepted HTML and uses the scene schema", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-video-plan-"));
  const config = createBridgeConfig({ projectRoot, workRoot: path.join(root, "work"), dataRoot: path.join(root, "data") });
  const manager = new WorkspaceManager(config);
  await manager.initialize();
  const input = {
    contentId: "video-plan-001",
    taskType: "video-plan",
    contentVersion: 1,
    instruction: "keep the order",
    creatorContext: null,
    contentBrief: null,
    confirmedContent: "# approved",
    styleConfig: { sourceMode: "accepted-html", htmlRunId: "run-html", htmlSha256: "a".repeat(64) },
    acceptedHtml: "<!doctype html><html><body><h1>第一章</h1></body></html>"
  };
  const workspace = await manager.create("run-11111111-1111-1111-1111-111111111111", input);
  assert.deepEqual(await readdir(path.join(workspace, ".agents/skills")), ["plan-creator-video"]);
  assert.deepEqual(await readdir(path.join(workspace, "schemas")), ["video-scene-plan.schema.json"]);
  assert.match(await readFile(path.join(workspace, "input/accepted-presentation.html"), "utf8"), /第一章/);
  assert.deepEqual((await manager.readInput({ workspace, contentId: input.contentId, taskType: input.taskType, contentVersion: 1 })).acceptedHtml, input.acceptedHtml);
  const specification = createTaskSpecification(input, workspace, 1000);
  assert.equal(specification.schemaPath, path.join(workspace, "schemas/video-scene-plan.schema.json"));
  assert.equal(specification.outputPath, path.join(workspace, "output/video-scene-plan.json"));
  assert.match(specification.prompt, /不生成 React、HTML、图片或 MP4/);
  assert.match(specification.prompt, /\$plan-creator-video/);

  const portraitSpecification = createTaskSpecification({ ...input, styleConfig: { ...input.styleConfig, aspectRatio: "9:16" } }, workspace, 1000);
  assert.match(portraitSpecification.prompt, /9:16（1080×1920）/);
  assert.match(portraitSpecification.prompt, /独立竖屏编排/);
  const longSpecification = createTaskSpecification({ ...input, styleConfig: { ...input.styleConfig, durationInFrames: 9000 } }, workspace, 1000);
  assert.match(longSpecification.prompt, /5 分钟/);
  assert.match(longSpecification.prompt, /9000 帧/);

  const plan = JSON.parse(await readFile(path.join(projectRoot, "video-renderer/fixtures/sample-scene-plan.json"), "utf8"));
  plan.sourceMode = "accepted-html";
  plan.sourceTrace = { htmlRunId: "run-html", htmlSha256: "a".repeat(64), htmlSections: ["第一章"] };
  await writeFile(path.join(workspace, "output/video-scene-plan.json"), `${JSON.stringify(plan)}\n`);
  const manifest = await finalizeTaskResult(input, workspace, plan);
  assert.equal(manifest.taskType, "video-plan");
  assert.equal(manifest.artifacts[0].id, "video-scene-plan");
});
