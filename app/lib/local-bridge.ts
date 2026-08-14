const BRIDGE_BASE_URL = "http://127.0.0.1:4317";

export type BridgeRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "timeout" | "interrupted";

export type BridgeRun = {
  runId: string;
  contentId: string;
  taskType: "research" | "angles" | "content" | "html" | "cover" | "publishing" | "video-plan" | "video-render";
  contentVersion: number;
  status: BridgeRunStatus;
  threadId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: { code: string; message: string } | null;
  parentRunId?: string;
  updatedAt?: string;
  progress?: number;
  phase?: "queued" | "bundling" | "rendering" | "merging" | "validating" | "completed";
  segmentIndex?: number;
  segmentCount?: number;
};

export type ContentResult = {
  recommendedSubtitle: string;
  audiencePain: string[];
  coreConflict: string;
  coreThesis: string;
  script: { opening: string; body: string; closing: string; fullMarkdown: string };
  [key: string]: unknown;
};

export type TopicAnglesResult = {
  generationMeta: {
    skillName: string;
    skillEvidence: string;
    researchUsed: boolean;
  };
  angles: Array<{
    type: string;
    title: string;
    viewpoint: string;
    audiencePain: string;
    contentValue: string;
    evidenceNeeded: string;
  }>;
};

export type TopicResearchResult = {
  generationMeta: { skillName: string; skillEvidence: string; researchUsed: boolean };
  summary: string;
  platformFindings: Array<{
    platform: string;
    accessibility: string;
    samples: Array<{ title: string; author: string; publishedAt: string; visibleMetrics: string; url: string; angle: string }>;
    limitations: string;
  }>;
  commonAngles: string[];
  contentGaps: string[];
  recommendedAngles: TopicAnglesResult["angles"];
  recommendedAngleIndex: number;
  manualFollowups: string[];
  limitations: string[];
};

export type DoctorReport = {
  overall: "pass" | "warn" | "fail";
  checkedAt: string;
  checks: Array<{
    id: string;
    status: "pass" | "warn" | "fail";
    message: string;
    fix: string | null;
    details: unknown;
  }>;
};

export type ArtifactManifest = {
  manifestVersion: string;
  taskType: "html" | "cover" | "publishing";
  generationMode: "codex-html" | "codex-imagegen-hybrid" | "codex-template-render" | "codex-publishing";
  artifacts: Array<{
    id: string;
    type: "recording-html" | "cover-16x9" | "cover-4x3" | "cover-3x4" | "publishing-package";
    path: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    sha256: string;
  }>;
  notes: string[];
};

export type VideoScene = {
  id: string;
  type: "opening" | "statement" | "flow" | "comparison" | "screenshot" | "summary";
  startFrame: number;
  durationInFrames: number;
  eyebrow: string;
  headline: string;
  body: string;
  emphasis: string[];
  items: string[];
  narration: string;
  transition: "none" | "fade" | "slide" | "wipe";
  showCaptions: boolean;
  materialIds: string[];
};

export type VideoScenePlan = {
  schemaVersion: "1.0";
  title: string;
  subtitle: string;
  sourceMode: "direct-content" | "accepted-html";
  aspectRatio: "16:9" | "9:16";
  fps: 30;
  width: 1920 | 1080;
  height: 1080 | 1920;
  durationInFrames: 900 | 9000 | 14400;
  sourceTrace: { htmlRunId: string; htmlSha256: string; htmlSections: string[] };
  theme: Record<"background" | "surface" | "primary" | "accent" | "text" | "muted", string>;
  materials: string[];
  scenes: VideoScene[];
  missingMaterials: string[];
  generationMeta: { skillName: "content-workstation-creator"; skillEvidence: "CW-SKILL-1.0"; researchUsed: false };
};

export type LocalAsset = {
  assetId: string;
  contentId: string;
  name: string;
  mimeType: string;
  kind: "image" | "audio" | "video" | "captions";
  size: number;
  filename: string;
  relativePath: string;
  createdAt: string;
};

export type VideoRenderManifest = {
  manifestVersion: "1.0";
  taskType: "video-render";
  generationMode: "remotion-local-render";
  templateVersion: string;
  remotionVersion: string;
  width: 1920 | 1080;
  height: 1080 | 1920;
  fps: 30;
  durationInFrames: 900 | 9000 | 14400;
  durationSeconds: number;
  artifacts: Array<{ id: "video-mp4" | "video-poster"; type: "video-mp4" | "video-poster"; path: string; mimeType: string; width: 1920 | 1080; height: 1080 | 1920; size: number; sha256: string }>;
  notes: string[];
};

let bridgeToken = "";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `本机 Codex Bridge 请求失败（${response.status}）`);
  return payload;
}

async function authorize() {
  if (bridgeToken) return bridgeToken;
  const response = await fetch(`${BRIDGE_BASE_URL}/v1/session`, { cache: "no-store" });
  const payload = await readJson<{ token: string }>(response);
  bridgeToken = payload.token;
  return bridgeToken;
}

async function authorizedFetch(pathname: string, init: RequestInit = {}) {
  const token = await authorize();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  return fetch(`${BRIDGE_BASE_URL}${pathname}`, { ...init, headers, cache: "no-store" });
}

export async function connectLocalBridge() {
  const health = await readJson<{ ok: boolean; version: string; activeRuns: number }>(
    await fetch(`${BRIDGE_BASE_URL}/v1/health`, { cache: "no-store" }),
  );
  await authorize();
  return health;
}

export async function listBridgeRuns() {
  return readJson<{ runs: BridgeRun[] }>(await authorizedFetch("/v1/runs"));
}

export async function runBridgeDoctor() {
  return readJson<DoctorReport>(await authorizedFetch("/v1/doctor", {
    method: "POST",
    body: "{}",
  }));
}

export async function getWorkstationState<T>() {
  return readJson<{ state: { version: "1.0"; updatedAt: string; database: T } | null }>(await authorizedFetch("/v1/workstation-state"));
}

export async function saveWorkstationState<T>(database: T) {
  return readJson<{ state: { version: "1.0"; updatedAt: string; database: T } }>(await authorizedFetch("/v1/workstation-state", {
    method: "PUT",
    body: JSON.stringify({ version: "1.0", database }),
  }));
}

export async function createContentRun(input: {
  contentId: string;
  contentVersion: number;
  instruction?: string;
  creatorContext: Record<string, unknown>;
  contentBrief: Record<string, unknown>;
}) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch("/v1/runs", {
    method: "POST",
    body: JSON.stringify({ ...input, taskType: "content" }),
  }));
}

export async function createTopicAnglesRun(input: {
  contentId: string;
  contentVersion: number;
  instruction?: string;
  creatorContext: Record<string, unknown>;
  contentBrief: Record<string, unknown>;
}) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch("/v1/runs", {
    method: "POST",
    body: JSON.stringify({ ...input, taskType: "angles" }),
  }));
}

export async function createTopicResearchRun(input: {
  contentId: string;
  contentVersion: number;
  instruction?: string;
  creatorContext: Record<string, unknown>;
  contentBrief: Record<string, unknown>;
}) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch("/v1/runs", {
    method: "POST",
    body: JSON.stringify({ ...input, taskType: "research" }),
  }));
}

export async function createVisualRun(input: {
  contentId: string;
  taskType: "html" | "cover" | "publishing";
  contentVersion: number;
  confirmedContent: string;
  styleConfig: Record<string, unknown>;
  instruction?: string;
}) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch("/v1/runs", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function createVideoPlanRun(input: {
  contentId: string;
  contentVersion: number;
  confirmedContent: string;
  styleConfig: Record<string, unknown>;
  acceptedHtml?: string;
  instruction?: string;
}) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch("/v1/runs", {
    method: "POST",
    body: JSON.stringify({ ...input, taskType: "video-plan" }),
  }));
}

export async function createVideoRenderRun(input: {
  contentId: string;
  contentVersion: number;
  scenePlan: VideoScenePlan;
  assetIds: string[];
  audioAssetId?: string;
  captionsAssetId?: string;
}) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch("/v1/runs", {
    method: "POST",
    body: JSON.stringify({ ...input, taskType: "video-render" }),
  }));
}

export async function uploadLocalAsset(input: { contentId: string; name: string; mimeType: string; dataBase64: string }) {
  return readJson<{ asset: LocalAsset }>(await authorizedFetch("/v1/assets", { method: "POST", body: JSON.stringify(input) }));
}

export async function listLocalAssets(contentId: string) {
  return readJson<{ assets: LocalAsset[] }>(await authorizedFetch(`/v1/assets?contentId=${encodeURIComponent(contentId)}`));
}

export async function deleteLocalAsset(contentId: string, assetId: string) {
  return readJson<{ asset: LocalAsset }>(await authorizedFetch(`/v1/assets/${encodeURIComponent(contentId)}/${encodeURIComponent(assetId)}`, { method: "DELETE" }));
}

export async function getLocalAssetBlob(contentId: string, assetId: string) {
  const response = await authorizedFetch(`/v1/assets/${encodeURIComponent(contentId)}/${encodeURIComponent(assetId)}/file`);
  if (!response.ok) throw new Error(`读取本地素材失败（${response.status}）`);
  return response.blob();
}

export async function continueBridgeRun(runId: string, instruction: string) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch(`/v1/runs/${encodeURIComponent(runId)}/continue`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  }));
}

export async function getBridgeRun(runId: string) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch(`/v1/runs/${encodeURIComponent(runId)}`));
}

export async function cancelBridgeRun(runId: string) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch(`/v1/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    body: "{}",
  }));
}

export async function retryBridgeRun(runId: string) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch(`/v1/runs/${encodeURIComponent(runId)}/retry`, {
    method: "POST",
    body: "{}",
  }));
}

export async function resumeVideoRenderRun(runId: string) {
  return readJson<{ run: BridgeRun }>(await authorizedFetch(`/v1/runs/${encodeURIComponent(runId)}/resume-render`, {method: "POST", body: "{}"}));
}

export async function getContentResult(runId: string) {
  return readJson<ContentResult>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/file/content-result`));
}

export async function getTopicAnglesResult(runId: string) {
  return readJson<TopicAnglesResult>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/file/topic-angles-result`));
}

export async function getTopicResearchResult(runId: string) {
  return readJson<TopicResearchResult>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/file/topic-research-result`));
}

export async function getVideoScenePlan(runId: string) {
  return readJson<VideoScenePlan>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/file/video-scene-plan`));
}

export async function getArtifactManifest(runId: string) {
  return readJson<ArtifactManifest>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/manifest`));
}

export async function getVideoRenderManifest(runId: string) {
  return readJson<VideoRenderManifest>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/manifest`));
}

export async function getArtifactBlob(runId: string, artifactId: string) {
  const response = await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/file/${encodeURIComponent(artifactId)}`);
  if (!response.ok) {
    const payload = await response.json() as { error?: { message?: string } };
    throw new Error(payload.error?.message || `读取产物失败（${response.status}）`);
  }
  return response.blob();
}

export async function getContentBundle(input: {
  contentId: string;
  title: string;
  subtitle: string;
  platforms: string[];
  script: string;
  runIds: { html?: string; cover?: string; publishing?: string; "video-render"?: string };
  videoPlan?: VideoScenePlan | null;
}) {
  const response = await authorizedFetch("/v1/exports/content-package", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json() as { error?: { message?: string } };
    throw new Error(payload.error?.message || `导出完整包失败（${response.status}）`);
  }
  return response.blob();
}

export function resetBridgeSessionForTests() {
  bridgeToken = "";
}
