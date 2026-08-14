const MIN_SCENE_FRAMES = 30;
const DEFAULT_MAX_SCENE_FRAMES = 300;
const DEFAULT_TOTAL_FRAMES = 900;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Math.round(value)));

export function rebalanceEditedSceneDuration(scenes, fixedIndex, requestedDuration, totalFrames = DEFAULT_TOTAL_FRAMES, maxSceneFrames = totalFrames === DEFAULT_TOTAL_FRAMES ? DEFAULT_MAX_SCENE_FRAMES : 900) {
  if (!Array.isArray(scenes) || scenes.length < 2 || fixedIndex < 0 || fixedIndex >= scenes.length) return scenes;
  const minimumFixed = Math.max(MIN_SCENE_FRAMES, totalFrames - maxSceneFrames * (scenes.length - 1));
  const maximumFixed = Math.min(maxSceneFrames, totalFrames - MIN_SCENE_FRAMES * (scenes.length - 1));
  const fixedDuration = clamp(requestedDuration, minimumFixed, maximumFixed);
  const otherIndices = scenes.map((_, index) => index).filter((index) => index !== fixedIndex);
  const remainingFrames = totalFrames - fixedDuration;
  const currentTotal = otherIndices.reduce((sum, index) => sum + clamp(scenes[index].durationInFrames, MIN_SCENE_FRAMES, maxSceneFrames), 0);
  const scale = currentTotal > 0 ? remainingFrames / currentTotal : 1;
  const durations = scenes.map((scene, index) => index === fixedIndex ? fixedDuration : clamp(scene.durationInFrames * scale, MIN_SCENE_FRAMES, maxSceneFrames));
  let difference = totalFrames - durations.reduce((sum, duration) => sum + duration, 0);
  let cursor = 0;
  while (difference !== 0 && cursor < 20_000) {
    const index = otherIndices[cursor % otherIndices.length];
    if (difference > 0 && durations[index] < maxSceneFrames) { durations[index] += 1; difference -= 1; }
    if (difference < 0 && durations[index] > MIN_SCENE_FRAMES) { durations[index] -= 1; difference += 1; }
    cursor += 1;
  }
  let startFrame = 0;
  return scenes.map((scene, index) => {
    const next = { ...scene, durationInFrames: durations[index], startFrame };
    startFrame += durations[index];
    return next;
  });
}
