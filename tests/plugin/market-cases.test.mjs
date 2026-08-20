import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const casesRoot = path.join(projectRoot, "tests/plugin");
const skillsRoot = path.join(projectRoot, "plugins/creator-content-studio/skills");
const knownSkills = new Set(["create-creator-content", "produce-creator-visuals", "plan-creator-video"]);

async function readJson(name) {
  return JSON.parse(await readFile(path.join(casesRoot, name), "utf8"));
}

function validateCommonCase(item, ids) {
  assert.match(item.id, /^[a-z0-9-]+$/u);
  assert.ok(!ids.has(item.id), `duplicate case id: ${item.id}`);
  ids.add(item.id);
  assert.equal(typeof item.prompt, "string");
  assert.ok(item.prompt.length >= 12 && item.prompt.length <= 240);
  assert.doesNotMatch(item.prompt, /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\|\bsk-[A-Za-z0-9_-]{20,}\b)/u);
}

test("positive market cases cover every public creator capability", async () => {
  const cases = await readJson("positive-cases.json");
  const ids = new Set();
  const expectedCapabilities = new Set([
    "content-draft",
    "missing-case-questions",
    "self-contained-html",
    "three-size-cover-fallback",
    "selected-platform-publishing",
    "editable-video-plan",
  ]);

  assert.ok(cases.length >= 5);
  for (const item of cases) {
    validateCommonCase(item, ids);
    assert.ok(knownSkills.has(item.expectedSkill), `unknown expected skill: ${item.expectedSkill}`);
    assert.ok(expectedCapabilities.has(item.capability), `unexpected capability: ${item.capability}`);
    assert.ok(Array.isArray(item.expectedBehaviors) && item.expectedBehaviors.length > 0);
    expectedCapabilities.delete(item.capability);
  }
  assert.deepEqual([...expectedCapabilities], []);
});

test("negative market cases explicitly stay outside all plugin Skills", async () => {
  const cases = await readJson("negative-cases.json");
  const ids = new Set();
  assert.ok(cases.length >= 3);
  for (const item of cases) {
    validateCommonCase(item, ids);
    assert.equal(item.expectedSkill, null);
    assert.ok(typeof item.reason === "string" && item.reason.length >= 12);
  }

  const skillText = await Promise.all([...knownSkills].map((skill) => readFile(path.join(skillsRoot, skill, "SKILL.md"), "utf8")));
  const combined = skillText.join("\n");
  assert.match(combined, /React|generic website development/u);
  assert.match(combined, /editing uploaded footage|MP4 editing/u);
  assert.match(combined, /content-library software development|databases/u);
});

test("edge cases define honest fallbacks instead of false success", async () => {
  const cases = await readJson("edge-cases.json");
  const ids = new Set();
  const expectedEdges = new Set(["search", "imageGeneration", "write", "contentApproved", "inputConflict"]);
  assert.equal(cases.length, expectedEdges.size);
  for (const item of cases) {
    validateCommonCase(item, ids);
    assert.ok(knownSkills.has(item.expectedSkill));
    assert.equal(Object.keys(item.capabilityState).length, 1);
    expectedEdges.delete(Object.keys(item.capabilityState)[0]);
    assert.ok(Array.isArray(item.expectedBehaviors) && item.expectedBehaviors.length >= 2);
  }
  assert.deepEqual([...expectedEdges], []);
});

test("market fixtures contain generic examples rather than private creator data", async () => {
  const files = ["positive-cases.json", "negative-cases.json", "edge-cases.json"];
  const combined = (await Promise.all(files.map((name) => readFile(path.join(casesRoot, name), "utf8")))).join("\n");
  assert.doesNotMatch(combined, /robbie|github\.com|https?:\/\//iu);
  assert.doesNotMatch(combined, /(?:\u5ba2\u6237\u540d|\u516c\u53f8\u540d)[:：]\s*[^\s,，]+/u);
  assert.doesNotMatch(combined, /\b(?:sk-|ghp_|AKIA|xoxb-)[A-Za-z0-9_-]+\b/u);
});
