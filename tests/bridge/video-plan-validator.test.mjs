import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { normalizeGeneratedVideoPlanMaterials, validateVideoPlanSemantics } from "../../bridge/video-plan-validator.mjs";

const samplePath = path.resolve(import.meta.dirname, "../../video-renderer/fixtures/sample-scene-plan.json");

test("video plan semantic validator enforces timeline, material and HTML trace rules", async () => {
  const sample = JSON.parse(await readFile(samplePath, "utf8"));
  assert.equal(validateVideoPlanSemantics(sample), sample);

  const portrait = structuredClone(sample);
  portrait.aspectRatio = "9:16";
  portrait.width = 1080;
  portrait.height = 1920;
  assert.equal(validateVideoPlanSemantics(portrait, { sourceMode: "direct-content", aspectRatio: "9:16" }), portrait);

  const mismatchedPortrait = structuredClone(portrait);
  mismatchedPortrait.width = 1920;
  assert.throws(() => validateVideoPlanSemantics(mismatchedPortrait), /supported 30 second/);

  const fiveMinute = structuredClone(sample);
  fiveMinute.durationInFrames = 9000;
  fiveMinute.scenes = Array.from({length: 30}, (_, index) => ({...structuredClone(sample.scenes[index % sample.scenes.length]), id: `scene-long-${index + 1}`, startFrame: index * 300, durationInFrames: 300, materialIds: []}));
  fiveMinute.materials = [];
  assert.equal(validateVideoPlanSemantics(fiveMinute, {sourceMode: "direct-content", durationInFrames: 9000}), fiveMinute);

  const gap = structuredClone(sample);
  gap.scenes[1].startFrame += 1;
  assert.throws(() => validateVideoPlanSemantics(gap), /must start/);

  const undeclared = structuredClone(sample);
  undeclared.scenes[0].materialIds = ["assets/missing.png"];
  assert.throws(() => validateVideoPlanSemantics(undeclared), /undeclared material/);

  const html = structuredClone(sample);
  html.sourceMode = "accepted-html";
  assert.throws(() => validateVideoPlanSemantics(html), /complete source trace/);

  const traced = structuredClone(sample);
  traced.sourceMode = "accepted-html";
  traced.sourceTrace = { htmlRunId: "run-html", htmlSha256: "a".repeat(64), htmlSections: ["第一章"] };
  assert.throws(() => validateVideoPlanSemantics(traced, { sourceMode: "accepted-html", htmlRunId: "run-other", htmlSha256: "a".repeat(64) }), /does not match/);
});

test("generated material suggestions become missing-material notes instead of broken references", async () => {
  const sample = JSON.parse(await readFile(samplePath, "utf8"));
  const invented = "assets/question-answer-mismatch-GENERATED-NOT-A-REAL-SCREENSHOT.png";
  sample.materials = [invented];
  sample.scenes[0].materialIds = [invented];
  const normalized = normalizeGeneratedVideoPlanMaterials(sample);
  assert.deepEqual(normalized.materials, []);
  assert.deepEqual(normalized.scenes[0].materialIds, []);
  assert.match(normalized.missingMaterials.join("\n"), /question-answer-mismatch/);
  assert.equal(validateVideoPlanSemantics(normalized), normalized);
});
