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

test("keeps content, HTML, cover, and publishing production as separate stages", async () => {
  const [page, css, bridgeClient] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/local-bridge.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /使用 Codex 生成内容/);
  assert.match(page, /Codex 生成 3 个角度/);
  assert.match(page, /交给 Codex/);
  assert.match(page, /startTopicResearch/);
  assert.match(page, /function TopicResearchModal/);
  assert.match(page, /function CodexConnectionPanel/);
  assert.match(page, /function FirstRunSetupModal/);
  assert.match(page, /function SetupGuidePanel/);
  assert.match(page, /npm run dev:local/);
  assert.match(page, /codex login status/);
  assert.match(page, /npm run video:install/);
  assert.match(page, /npm run video:browser/);
  assert.match(page, /Remotion 使用提醒/);
  assert.match(page, /FFmpeg 媒体工具/);
  assert.match(page, /isProfileConfigured/);
  assert.match(page, /function TaskCenter/);
  assert.match(page, /pollTopicAnglesRun/);
  assert.match(page, /完成后会自动回填/);
  assert.match(page, /ContentGenerationPanel/);
  assert.match(page, /contentVersions/);
  assert.match(page, /采用这个版本/);
  assert.match(page, /确认内容，进入视觉制作/);
  assert.match(page, /const htmlStyles/);
  assert.match(page, /const coverStyles/);
  assert.match(page, /高冲击人物科技/);
  assert.match(page, /无本人照片时自动改用焦点物体/);
  assert.match(page, /approved-creator-asset-only/);
  assert.match(page, /function VisualGenerationPanel/);
  assert.match(page, /function VideoPlanPanel/);
  assert.match(page, /基于已确认 HTML/);
  assert.match(page, /确认场景方案/);
  assert.match(page, /copyScene/);
  assert.match(page, /function ArtifactPreview/);
  assert.match(page, /接受这版产物/);
  assert.match(page, /publishingPackageLabel/);
  assert.match(page, /function missingPublishingAssets/);
  assert.match(page, /item\.htmlStyle === style/);
  assert.match(page, /item\.coverStyle === style/);
  assert.match(page, /查看解锁条件/);
  assert.match(page, /run-activity/);
  assert.match(page, /function BundleExportPanel/);
  assert.match(page, /下载 ZIP/);
  assert.match(page, /下载发布包 Markdown/);
  assert.match(page, /继续修改/);
  assert.match(page, /continueProductionRun/);
  assert.match(page, /模板降级/);
  assert.match(page, /function InlineCreationWorkflow/);
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
  assert.match(css, /\.generation-panel/);
  assert.match(css, /\.bridge-chip/);
  assert.match(css, /\.visual-generation/);
  assert.match(css, /\.cover-artifact-grid/);
  assert.match(css, /\.publishing-artifact-preview/);
  assert.match(css, /\.video-plan-panel/);
  assert.match(css, /\.scene-editor/);
  assert.match(bridgeClient, /\/v1\/session/);
  assert.match(bridgeClient, /createContentRun/);
  assert.match(bridgeClient, /createTopicAnglesRun/);
  assert.match(bridgeClient, /createTopicResearchRun/);
  assert.match(bridgeClient, /getTopicResearchResult/);
  assert.match(bridgeClient, /runBridgeDoctor/);
  assert.match(bridgeClient, /retryBridgeRun/);
  assert.match(bridgeClient, /getTopicAnglesResult/);
  assert.match(bridgeClient, /getContentResult/);
  assert.match(bridgeClient, /createVisualRun/);
  assert.match(bridgeClient, /createVideoPlanRun/);
  assert.match(bridgeClient, /getVideoScenePlan/);
  assert.match(bridgeClient, /continueBridgeRun/);
  assert.match(bridgeClient, /getArtifactManifest/);
  assert.match(bridgeClient, /getArtifactBlob/);
  assert.match(bridgeClient, /getContentBundle/);
});
