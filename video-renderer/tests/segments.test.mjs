import assert from 'node:assert/strict';
import test from 'node:test';
import {buildRenderSegments} from '../src/segments.mjs';

test('long renders split only on scene boundaries and cover the full timeline', () => {
  const scenes = Array.from({length: 30}, (_, index) => ({startFrame: index * 300, durationInFrames: 300}));
  const segments = buildRenderSegments(scenes, 1800);
  assert.equal(segments.length, 5);
  assert.deepEqual(segments[0], {index: 0, startFrame: 0, endFrame: 1800});
  assert.deepEqual(segments.at(-1), {index: 4, startFrame: 7200, endFrame: 9000});
  assert.ok(segments.every((segment, index) => index === 0 || segment.startFrame === segments[index - 1].endFrame));
});

test('a short render remains one segment', () => {
  assert.deepEqual(buildRenderSegments([{startFrame: 0, durationInFrames: 900}]), [{index: 0, startFrame: 0, endFrame: 900}]);
});
