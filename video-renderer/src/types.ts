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
  narration: string;
  transition: 'none' | 'fade' | 'slide' | 'wipe';
  showCaptions: boolean;
  materialIds: string[];
  materialKinds?: Record<string, 'image' | 'video'>;
  muteMaterialVideo?: boolean;
};

export type VideoScenePlan = {
  schemaVersion: '1.0';
  title: string;
  subtitle: string;
  sourceMode: 'direct-content' | 'accepted-html';
  aspectRatio: '16:9' | '9:16';
  fps: 30;
  width: 1920 | 1080;
  height: 1080 | 1920;
  durationInFrames: 900 | 9000 | 14400;
  sourceTrace: {
    htmlRunId: string;
    htmlSha256: string;
    htmlSections: string[];
  };
  theme: Theme;
  materials: string[];
  scenes: Scene[];
  missingMaterials: string[];
  generationMeta: {
    skillName: 'content-workstation-creator';
    skillEvidence: 'CW-SKILL-1.0';
    researchUsed: false;
  };
};

export type CaptionCue = { startMs: number; endMs: number; text: string };

export type VideoRenderProps = VideoScenePlan & {
  audioSrc?: string;
  captions?: CaptionCue[];
  assetUrlMap?: Record<string, string>;
  assetKindMap?: Record<string, 'image' | 'video'>;
};
