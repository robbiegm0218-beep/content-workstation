import { randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createBridgeRuntime } from "../bridge/server.mjs";
import { BRIDGE_SKILL_EVIDENCE } from "../bridge/skill-adapter.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const smokeRoot = path.join(projectRoot, "work/a2-bridge-smoke");
await mkdir(smokeRoot, { recursive: true });
const token = randomBytes(24).toString("base64url");
const creatorContext = JSON.parse(await readFile(path.join(projectRoot, "tests/fixtures/a0/creator-context.json"), "utf8"));
const contentBrief = JSON.parse(await readFile(path.join(projectRoot, "tests/fixtures/a0/content-brief.json"), "utf8"));

const runtime = await createBridgeRuntime({
  token,
  config: {
    projectRoot,
    dataRoot: path.join(smokeRoot, ".data"),
    workRoot: path.join(smokeRoot, "work"),
    tokenPath: path.join(smokeRoot, ".data/token"),
    port: 0
  }
});

try {
  await runtime.listen();
  const port = runtime.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Origin: "http://localhost:3000"
  };
  const createdResponse = await fetch(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      contentId: "a2-real-smoke",
      taskType: "content",
      contentVersion: 1,
      instruction: "这是 Bridge 端到端技术验证，不生成 HTML 或封面。",
      creatorContext,
      contentBrief
    })
  });
  const created = await createdResponse.json();
  if (createdResponse.status !== 202) throw new Error(JSON.stringify(created));
  const runId = created.run.runId;

  let run;
  for (let attempt = 0; attempt < 960; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/runs/${runId}`, { headers });
    run = (await response.json()).run;
    if (["completed", "failed", "cancelled", "timeout"].includes(run.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (run?.status !== "completed") throw new Error(`Bridge run ended with ${run?.status}: ${JSON.stringify(run?.error)}`);

  const contentResponse = await fetch(`${baseUrl}/v1/artifacts/${runId}/file/content-result`, { headers });
  const content = await contentResponse.json();
  if (content.generationMeta?.skillEvidence !== BRIDGE_SKILL_EVIDENCE) {
    throw new Error("Bridge result is missing adapter evidence");
  }
  const eventsResponse = await fetch(`${baseUrl}/v1/runs/${runId}/events`, { headers });
  const events = await eventsResponse.text();
  const eventCount = (events.match(/^event:/gm) ?? []).length;

  const continueResponse = await fetch(`${baseUrl}/v1/runs/${runId}/continue`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ instruction: "保持核心观点不变，把推荐副标题调整得更强调产品判断。" })
  });
  const continued = await continueResponse.json();
  if (continueResponse.status !== 202) throw new Error(`Continue failed: ${JSON.stringify(continued)}`);
  let continuedRun;
  for (let attempt = 0; attempt < 960; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/runs/${continued.run.runId}`, { headers });
    continuedRun = (await response.json()).run;
    if (["completed", "failed", "cancelled", "timeout"].includes(continuedRun.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (continuedRun?.status !== "completed") {
    throw new Error(`Continued Bridge run ended with ${continuedRun?.status}: ${JSON.stringify(continuedRun?.error)}`);
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    runId,
    status: run.status,
    threadId: run.threadId,
    eventCount,
    skillEvidence: content.generationMeta.skillEvidence,
    artifactId: run.artifactManifest.artifacts[0].id,
    continuedRunId: continuedRun.runId,
    continuedStatus: continuedRun.status,
    resumedThreadId: continuedRun.threadId,
    persistedRecord: path.join(smokeRoot, ".data/runs", runId, "run.json")
  }, null, 2)}\n`);
} finally {
  await runtime.close();
}
