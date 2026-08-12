export type SceneType =
  | 'opening'
  | 'statement'
  | 'flow'
  | 'comparison'
  | 'screenshot'
  | 'summary';

export type Theme = {
  background: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  muted: string;
};

export type Scene = {
  id: string;
  type: SceneType;
  startFrame: number;
  durationInFrames: number;
  eyebrow: string;
  headline: string;
  body: string;
  emphasis: string[];
  items: string[];
};

export type VideoScenePlan = {
  schemaVersion: '1.0';
  title: string;
  subtitle: string;
  sourceMode: 'direct-content' | 'accepted-html';
  aspectRatio: '16:9';
  fps: 30;
  width: 1920;
  height: 1080;
  durationInFrames: 900;
  theme: Theme;
  materials: string[];
  scenes: Scene[];
};
