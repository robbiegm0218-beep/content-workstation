import assert from "node:assert/strict";
import test from "node:test";
import { rebalanceEditedSceneDuration } from "../app/lib/video-plan-timeline.mjs";

test("editing one scene duration keeps a contiguous 900-frame timeline", () => {
  const scenes = Array.from({ length: 12 }, (_, index) => ({ id: `scene-${index}`, startFrame: index * 75, durationInFrames: 75 }));
  const result = rebalanceEditedSceneDuration(scenes, 4, 300);
  assert.equal(result[4].durationInFrames, 300);
  assert.equal(result.reduce((sum, scene) => sum + scene.durationInFrames, 0), 900);
  assert.ok(result.every((scene) => scene.durationInFrames >= 30 && scene.durationInFrames <= 300));
  assert.ok(result.every((scene, index) => index === 0 || scene.startFrame === result[index - 1].startFrame + result[index - 1].durationInFrames));
});

test("editing a five-minute scene keeps a contiguous 9000-frame timeline", () => {
  const scenes = Array.from({ length: 30 }, (_, index) => ({ id: `scene-long-${index}`, startFrame: index * 300, durationInFrames: 300 }));
  const result = rebalanceEditedSceneDuration(scenes, 10, 720, 9000, 900);
  assert.equal(result[10].durationInFrames, 720);
  assert.equal(result.reduce((sum, scene) => sum + scene.durationInFrames, 0), 9000);
  assert.ok(result.every((scene) => scene.durationInFrames >= 30 && scene.durationInFrames <= 900));
  assert.ok(result.every((scene, index) => index === 0 || scene.startFrame === result[index - 1].startFrame + result[index - 1].durationInFrames));
});
