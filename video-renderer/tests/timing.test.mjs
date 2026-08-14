import assert from "node:assert/strict";
import test from "node:test";
import { sceneTransitionFrames, selectPosterFrame } from "../src/timing.mjs";

for (const duration of [30, 31, 45, 75, 300]) {
  test(`transition timing remains ordered for ${duration} frames`, () => {
    const timing = sceneTransitionFrames(duration);
    const points = [0, timing.fadeInEnd, timing.fadeOutStart, timing.lastFrame];
    assert.equal(points.every((value, index) => index === 0 || value > points[index - 1]), true);
    assert.equal(timing.lastFrame, duration - 1);
  });
}

test("poster frame is placed inside a scene instead of on its fade-in boundary", () => {
  const scenes = [
    { startFrame: 0, durationInFrames: 120 },
    { startFrame: 120, durationInFrames: 90 },
    { startFrame: 210, durationInFrames: 75 },
  ];
  assert.equal(selectPosterFrame(scenes, 210), 247);
});
