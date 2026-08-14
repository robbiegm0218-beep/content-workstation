export function sceneTransitionFrames(durationInFrames: number): {
  fadeInEnd: number;
  fadeOutStart: number;
  lastFrame: number;
  translateEnd: number;
};

export function selectPosterFrame(scenes: Array<{ startFrame: number; durationInFrames: number }>, preferredFrame?: number): number;
