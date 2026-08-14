export type RenderSegment = {index: number; startFrame: number; endFrame: number};
export function buildRenderSegments(scenes: Array<{startFrame: number; durationInFrames: number}>, targetFrames?: number): RenderSegment[];
