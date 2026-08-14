export function buildRenderSegments(scenes, targetFrames = 1800) {
  const segments = [];
  let startFrame = 0;
  let endFrame = 0;
  for (const scene of scenes) {
    const sceneEnd = scene.startFrame + scene.durationInFrames;
    if (endFrame > startFrame && sceneEnd - startFrame > targetFrames) {
      segments.push({index: segments.length, startFrame, endFrame});
      startFrame = scene.startFrame;
    }
    endFrame = sceneEnd;
  }
  if (endFrame > startFrame) segments.push({index: segments.length, startFrame, endFrame});
  return segments;
}
