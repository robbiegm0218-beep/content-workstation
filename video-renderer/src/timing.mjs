export function sceneTransitionFrames(durationInFrames) {
  const lastFrame = Math.max(3, Math.floor(durationInFrames) - 1);
  const edgeFrames = Math.max(1, Math.min(16, Math.floor((lastFrame - 1) / 3)));
  return {
    fadeInEnd: edgeFrames,
    fadeOutStart: lastFrame - edgeFrames,
    lastFrame,
    translateEnd: Math.max(1, Math.min(20, lastFrame)),
  };
}

export function selectPosterFrame(scenes, preferredFrame = 210) {
  if (!Array.isArray(scenes) || scenes.length === 0) return Math.max(0, Math.floor(preferredFrame));
  const target = Math.max(0, Math.floor(preferredFrame));
  const scene = scenes.find((entry) => target >= entry.startFrame && target < entry.startFrame + entry.durationInFrames)
    ?? scenes.find((entry) => entry.startFrame > target)
    ?? scenes.at(-1);
  const inset = Math.max(1, Math.min(scene.durationInFrames - 2, Math.floor(scene.durationInFrames / 2)));
  return scene.startFrame + inset;
}
