const BRIDGE_BASE_URL = "http://127.0.0.1:4317";

export type BridgeRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "timeout" | "interrupted";

export type BridgeRun = {
  runId: string;
  contentId: string;
  taskType: "angles" | "content" | "html" | "cover" | "publishing";
  contentVersion: number;
  status: BridgeRunStatus;
  threadId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: { code: string; message: string } | null;
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

export async function getContentResult(runId: string) {
  return readJson<ContentResult>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/file/content-result`));
}

export async function getTopicAnglesResult(runId: string) {
  return readJson<TopicAnglesResult>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/file/topic-angles-result`));
}

export async function getArtifactManifest(runId: string) {
  return readJson<ArtifactManifest>(await authorizedFetch(`/v1/artifacts/${encodeURIComponent(runId)}/manifest`));
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
  runIds: { html?: string; cover?: string; publishing?: string };
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
