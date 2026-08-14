import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBridgeRuntime } from "../../bridge/server.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const token = "local-test-token-0123456789";
const observedResumeThreads = [];
const observedSearchRuns = [];

async function fakeRunner(options) {
  if (options.resumeThreadId) observedResumeThreads.push(options.resumeThreadId);
  if (options.search) observedSearchRuns.push(options.outputPath);
  options.onEvent?.({ type: "thread.started", thread_id: "thread-fake-bridge" });
  options.onEvent?.({ type: "turn.started" });
  const result = options.outputPath.endsWith("topic-research.json") ? {
    generationMeta: {
      skillName: "content-workstation-creator",
      skillEvidence: "CW-SKILL-1.0",
      researchUsed: true
    },
    summary: "多数内容讲概念，缺少实际决策顺序。",
    platformFindings: [{
      platform: "B站",
      accessibility: "可检索",
      samples: [{
        title: "RAG 后台怎么做",
        author: "示例作者",
        publishedAt: "2026-01-01",
        visibleMetrics: "测试样本",
        url: "https://www.bilibili.com/video/test",
        angle: "后台功能拆解"
      }],
      limitations: "测试数据"
    }],
    commonAngles: ["概念介绍"],
    contentGaps: ["质量关卡"],
    recommendedAngles: [
      { type: "误区纠偏", title: "别先搭后台", viewpoint: "先定义质量关卡", audiencePain: "容易从功能清单开始", contentValue: "建立判断顺序", evidenceNeeded: "补充项目决策案例" },
      { type: "实战方法", title: "四步拆解", viewpoint: "按数据流逐段验收", audiencePain: "不知道如何推进", contentValue: "给出执行方法", evidenceNeeded: "补充验收指标" },
      { type: "转型视角", title: "能力迁移", viewpoint: "传统产品能力可以复用", audiencePain: "担心技术门槛", contentValue: "明确学习重点", evidenceNeeded: "补充迁移案例" }
    ],
    recommendedAngleIndex: 1,
    manualFollowups: ["在视频号手动复核"],
    limitations: ["测试环境未访问真实平台"]
  } : options.outputPath.endsWith("topic-angles.json") ? {
    generationMeta: {
      skillName: "content-workstation-creator",
      skillEvidence: "CW-SKILL-1.0",
      researchUsed: false
    },
    angles: [
      { type: "误区纠偏", title: "别先搭后台", viewpoint: "先定义质量关卡", audiencePain: "容易从功能清单开始", contentValue: "建立判断顺序", evidenceNeeded: "补充项目决策案例" },
      { type: "实战方法", title: "四步拆解", viewpoint: "按数据流逐段验收", audiencePain: "不知道如何推进", contentValue: "给出执行方法", evidenceNeeded: "补充验收指标" },
      { type: "转型视角", title: "能力迁移", viewpoint: "传统产品能力可以复用", audiencePain: "担心技术门槛", contentValue: "明确学习重点", evidenceNeeded: "补充迁移案例" }
    ]
  } : {
    generationMeta: {
      skillName: "content-workstation-creator",
      skillEvidence: "CW-SKILL-1.0",
      researchUsed: false
    }
  };
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, JSON.stringify(result));
  options.onEvent?.({ type: "turn.completed" });
  return { threadId: "thread-fake-bridge", structuredResult: result };
}

async function jsonRequest(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

test("Bridge enforces loopback, Origin, token, task whitelist, persistence and artifact access", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-bridge-"));
  const runtime = await createBridgeRuntime({
    token,
    runner: fakeRunner,
    config: {
      projectRoot,
      dataRoot: path.join(root, ".data"),
      workRoot: path.join(root, "work"),
      tokenPath: path.join(root, ".data/token"),
      port: 0
    },
    doctor: async () => ({ overall: "pass", checks: [] })
  });
  await runtime.listen();
  context.after(() => runtime.close());
  const address = runtime.server.address();
  assert.equal(address.address, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await jsonRequest(baseUrl, "/v1/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);

  const sessionWithoutOrigin = await jsonRequest(baseUrl, "/v1/session");
  assert.equal(sessionWithoutOrigin.response.status, 403);

  const session = await jsonRequest(baseUrl, "/v1/session", {
    headers: { Origin: "http://localhost:3000" }
  });
  assert.equal(session.response.status, 200);
  assert.equal(session.body.token, token);

  const unauthorized = await jsonRequest(baseUrl, "/v1/runs");
  assert.equal(unauthorized.response.status, 401);

  const forbiddenOrigin = await jsonRequest(baseUrl, "/v1/runs", {
    headers: { Authorization: `Bearer ${token}`, Origin: "https://evil.example" }
  });
  assert.equal(forbiddenOrigin.response.status, 403);

  const emptyWorkstationState = await jsonRequest(baseUrl, "/v1/workstation-state", {
    headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost:3000" }
  });
  assert.equal(emptyWorkstationState.response.status, 200);
  assert.equal(emptyWorkstationState.body.state, null);

  const savedWorkstationState = await jsonRequest(baseUrl, "/v1/workstation-state", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({
      version: "1.0",
      database: { contents: [{ id: "content-001", title: "RAG flow" }], cases: [], settings: { name: "Tester" } }
    })
  });
  assert.equal(savedWorkstationState.response.status, 200);
  assert.equal(savedWorkstationState.body.state.database.contents[0].title, "RAG flow");

  const restoredWorkstationState = await jsonRequest(baseUrl, "/v1/workstation-state", {
    headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost:3000" }
  });
  assert.equal(restoredWorkstationState.response.status, 200);
  assert.equal(restoredWorkstationState.body.state.database.settings.name, "Tester");

  const assetBytes = Buffer.from("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n开始\n");
  const registeredAsset = await jsonRequest(baseUrl, "/v1/assets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({ contentId: "content-001", name: "captions.vtt", mimeType: "text/vtt", dataBase64: assetBytes.toString("base64") })
  });
  assert.equal(registeredAsset.response.status, 201);
  assert.equal(registeredAsset.body.asset.kind, "captions");
  const assetId = registeredAsset.body.asset.assetId;
  const assetFile = await fetch(`${baseUrl}/v1/assets/content-001/${assetId}/file`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(assetFile.status, 200);
  assert.deepEqual(Buffer.from(await assetFile.arrayBuffer()), assetBytes);
  const deletedAsset = await jsonRequest(baseUrl, `/v1/assets/content-001/${assetId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  assert.equal(deletedAsset.response.status, 200);
  assert.equal(deletedAsset.body.asset.assetId, assetId);

  const bundleResponse = await fetch(`${baseUrl}/v1/exports/content-package`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({
      contentId: "content-001",
      title: "RAG flow",
      subtitle: "完整链路",
      platforms: ["B站"],
      script: "# 已确认内容稿",
      runIds: {}
    })
  });
  assert.equal(bundleResponse.status, 200);
  assert.equal(bundleResponse.headers.get("content-type"), "application/zip");
  assert.equal(bundleResponse.headers.get("x-content-workstation-files"), "2");
  const bundleBytes = Buffer.from(await bundleResponse.arrayBuffer());
  assert.equal(bundleBytes.readUInt32LE(0), 0x04034b50);

  const rejectedField = await jsonRequest(baseUrl, "/v1/runs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contentId: "content-001",
      taskType: "content",
      contentVersion: 1,
      creatorContext: {},
      contentBrief: {},
      shellCommand: "whoami"
    })
  });
  assert.equal(rejectedField.response.status, 400);
  assert.equal(rejectedField.body.error.code, "UNKNOWN_FIELD");

  const created = await jsonRequest(baseUrl, "/v1/runs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "http://localhost:3000",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contentId: "content-001",
      taskType: "content",
      contentVersion: 1,
      instruction: "Keep it practical",
      creatorContext: { voice: "practical" },
      contentBrief: { title: "RAG flow" }
    })
  });
  assert.equal(created.response.status, 202);
  const runId = created.body.run.runId;

  let run;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const current = await jsonRequest(baseUrl, `/v1/runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    run = current.body.run;
    if (run.status === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(run.status, "completed");
  assert.equal(run.workspace, undefined);
  assert.equal(run.threadId, "thread-fake-bridge");
  const internalRun = runtime.taskManager.get(runId);
  assert.ok(internalRun.workspace.startsWith(path.join(root, "work")));
  await Promise.all([
    access(path.join(internalRun.workspace, ".git")),
    access(path.join(internalRun.workspace, ".agents/skills/content-workstation-creator/SKILL.md")),
    access(path.join(internalRun.workspace, "input/task.json")),
    access(path.join(internalRun.workspace, "input/creator-context.json")),
    access(path.join(internalRun.workspace, "input/content-brief.json")),
    access(path.join(internalRun.workspace, "output/content-result.json"))
  ]);

  const eventsResponse = await fetch(`${baseUrl}/v1/runs/${runId}/events`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const events = await eventsResponse.text();
  assert.match(events, /bridge\.run\.started/);
  assert.match(events, /bridge\.run\.completed/);

  const manifest = await jsonRequest(baseUrl, `/v1/artifacts/${runId}/manifest`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(manifest.response.status, 200);
  assert.equal(manifest.body.artifacts[0].id, "content-result");

  const artifactResponse = await fetch(`${baseUrl}/v1/artifacts/${runId}/file/content-result`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(artifactResponse.status, 200);
  assert.equal((await artifactResponse.json()).generationMeta.skillEvidence, "CW-SKILL-1.0");

  const anglesCreated = await jsonRequest(baseUrl, "/v1/runs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "http://localhost:3000",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contentId: "angles-001",
      taskType: "angles",
      contentVersion: 1,
      creatorContext: { voice: "practical" },
      contentBrief: { topic: "RAG 后台流转" }
    })
  });
  assert.equal(anglesCreated.response.status, 202);
  const anglesRunId = anglesCreated.body.run.runId;
  let anglesRun;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const current = await jsonRequest(baseUrl, `/v1/runs/${anglesRunId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    anglesRun = current.body.run;
    if (anglesRun.status === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(anglesRun.status, "completed");
  const anglesArtifact = await fetch(`${baseUrl}/v1/artifacts/${anglesRunId}/file/topic-angles-result`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(anglesArtifact.status, 200);
  assert.equal((await anglesArtifact.json()).angles.length, 3);

  const researchCreated = await jsonRequest(baseUrl, "/v1/runs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: "http://localhost:3000",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contentId: "research-001",
      taskType: "research",
      contentVersion: 1,
      creatorContext: { voice: "practical" },
      contentBrief: { topic: "RAG 后台流转", platforms: ["B站"] }
    })
  });
  assert.equal(researchCreated.response.status, 202);
  const researchRunId = researchCreated.body.run.runId;
  let researchRun;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const current = await jsonRequest(baseUrl, `/v1/runs/${researchRunId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    researchRun = current.body.run;
    if (researchRun.status === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(researchRun.status, "completed");
  assert.ok(observedSearchRuns.some((outputPath) => outputPath.endsWith("topic-research.json")));
  const researchArtifact = await fetch(`${baseUrl}/v1/artifacts/${researchRunId}/file/topic-research-result`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(researchArtifact.status, 200);
  assert.equal((await researchArtifact.json()).recommendedAngles.length, 3);

  const retried = await jsonRequest(baseUrl, `/v1/runs/${researchRunId}/retry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(retried.response.status, 202);
  assert.notEqual(retried.body.run.runId, researchRunId);
  let retriedRun;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const current = await jsonRequest(baseUrl, `/v1/runs/${retried.body.run.runId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    retriedRun = current.body.run;
    if (retriedRun.status === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(retriedRun.status, "completed");

  const unknownArtifact = await jsonRequest(baseUrl, `/v1/artifacts/${runId}/file/not-registered`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(unknownArtifact.response.status, 404);

  const continued = await jsonRequest(baseUrl, `/v1/runs/${runId}/continue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ instruction: "Make the opening shorter" })
  });
  assert.equal(continued.response.status, 202);
  const continuedRunId = continued.body.run.runId;
  let continuedRun;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const current = await jsonRequest(baseUrl, `/v1/runs/${continuedRunId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    continuedRun = current.body.run;
    if (continuedRun.status === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(continuedRun.status, "completed");
  assert.equal(continuedRun.parentRunId, runId);
  assert.equal(observedResumeThreads.at(-1), "thread-fake-bridge");
});
