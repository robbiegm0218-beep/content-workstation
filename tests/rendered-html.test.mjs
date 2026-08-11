import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the content workstation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>内容工作站｜从灵感到发布复盘<\/title>/i);
  assert.match(html, /内容工作站/);
  assert.match(html, /新建内容/);
  assert.match(html, /内容库/);
  assert.match(html, /数据复盘/);
  assert.match(html, /先创建第一期内容/);
  assert.doesNotMatch(html, /传统产品转型 AI 产品/);
  assert.doesNotMatch(html, /AI 产品还要不要写 PRD/);
});

test("keeps content, HTML, and cover production as separate stages", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /【本次只做内容】/);
  assert.match(page, /不生成 HTML 页面，不生成封面图/);
  assert.match(page, /确认内容，进入视觉制作/);
  assert.match(page, /function htmlTaskPromptFor/);
  assert.match(page, /function coverTaskPromptFor/);
  assert.match(page, /const htmlStyles/);
  assert.match(page, /const coverStyles/);
  assert.match(page, /生成 HTML 任务指令/);
  assert.match(page, /生成封面任务指令/);
  assert.match(page, /function InlineCreationWorkflow/);
  assert.match(page, /生成后直接回到本页粘贴、编辑和确认/);
  assert.match(page, /const priorityContent = useMemo/);
  assert.match(page, /productionStagesFor\(priorityContent\)/);
  assert.match(page, /真实制作节点/);
  assert.match(page, /function deleteContent/);
  assert.match(page, /function deleteCase/);
  assert.match(page, /function clearAllContent/);
  assert.match(page, /清空全部内容与案例/);
  assert.match(page, /归档历史内容/);
  assert.match(page, /function addHistoricalContent/);
  assert.match(page, /历史归档/);
  assert.match(page, /publishLinks/);
  assert.match(page, /contents: \[\]/);
  assert.match(page, /cases: \[\]/);
  assert.match(css, /\.stage-flow/);
  assert.match(css, /\.content-editor/);
  assert.match(css, /\.inline-workflow/);
  assert.match(css, /\.style-grid/);
  assert.match(css, /\.production-lock/);
  assert.match(css, /\.detail-panel \.secondary-button/);
});
