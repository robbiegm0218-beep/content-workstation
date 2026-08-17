import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBridgeConfig } from "../../bridge/config.mjs";
import { resolveTaskSkill, TASK_SKILL_ROUTES } from "../../bridge/task-definition.mjs";
import { WorkspaceManager } from "../../bridge/workspace-manager.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../..");

test("creator task types route to the three public plugin Skills", () => {
  assert.deepEqual(TASK_SKILL_ROUTES, {
    research: "create-creator-content",
    angles: "create-creator-content",
    content: "create-creator-content",
    publishing: "create-creator-content",
    html: "produce-creator-visuals",
    cover: "produce-creator-visuals",
    "video-plan": "plan-creator-video"
  });
  assert.equal(resolveTaskSkill("cover"), "produce-creator-visuals");
  assert.throws(() => resolveTaskSkill("video-render"), /No creator plugin Skill route/);
});

test("isolated content workspace copies only the routed Skill and schema", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "creator-plugin-routing-"));
  const config = createBridgeConfig({ projectRoot, workRoot: path.join(root, "work"), dataRoot: path.join(root, "data") });
  const manager = new WorkspaceManager(config);
  await manager.initialize();
  const workspace = await manager.create("run-22222222-2222-2222-2222-222222222222", {
    contentId: "content-routing",
    taskType: "content",
    contentVersion: 1,
    instruction: "",
    creatorContext: { role: "产品经理" },
    contentBrief: { topic: "RAG" }
  });

  assert.deepEqual(await readdir(path.join(workspace, ".agents/skills")), ["create-creator-content"]);
  assert.deepEqual(await readdir(path.join(workspace, "schemas")), ["content-result.schema.json"]);
});
