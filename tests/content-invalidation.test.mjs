import assert from "node:assert/strict";
import test from "node:test";
import { invalidateFromContent, invalidateFromCover, invalidateFromHtml, invalidateVideoRender } from "../app/lib/content-invalidation.mjs";

function item(overrides = {}) {
  return {
    htmlState: "已生成", htmlRunId: "run-html", htmlManifest: {}, pendingHtmlRunId: "run-html-pending", pendingHtmlManifest: {},
    coverState: "已生成", coverRunId: "run-cover", coverManifest: {}, pendingCoverRunId: "run-cover-pending", pendingCoverManifest: {},
    publishingState: "已生成", publishingRunId: "run-publishing", publishingManifest: {}, pendingPublishingRunId: "run-publishing-pending", pendingPublishingManifest: {},
    videoEnabled: true, videoSource: "direct-content", videoPlanState: "已确认", videoPlanRunId: "run-plan", videoPlan: {}, pendingVideoPlanRunId: "run-plan-pending", pendingVideoPlan: {},
    videoRenderState: "已生成", videoRenderRunId: "run-render", videoRenderManifest: {}, pendingVideoRenderRunId: "run-render-pending", pendingVideoRenderManifest: {},
    ...overrides,
  };
}

test("content changes invalidate every generated downstream artifact", () => {
  const result = invalidateFromContent(item());
  assert.equal(result.htmlState, "待生成");
  assert.equal(result.coverState, "待生成");
  assert.equal(result.publishingState, "待生成");
  assert.equal(result.videoPlanState, "待生成");
  assert.equal(result.videoRenderState, "待渲染");
  assert.equal(result.htmlManifest, null);
  assert.equal(result.videoPlan, null);
  assert.equal(result.videoRenderManifest, null);
});

test("HTML changes only invalidate HTML consumers", () => {
  const direct = invalidateFromHtml(item());
  assert.equal(direct.videoPlanState, "已确认");
  assert.equal(direct.videoRenderState, "已生成");
  assert.equal(direct.publishingState, "待生成");
  const evolved = invalidateFromHtml(item({ videoSource: "accepted-html" }));
  assert.equal(evolved.videoPlanState, "待生成");
  assert.equal(evolved.videoRenderState, "待渲染");
});

test("cover and material changes invalidate only their consumers", () => {
  const cover = invalidateFromCover(item());
  assert.equal(cover.publishingState, "待生成");
  assert.equal(cover.videoRenderState, "已生成");
  const material = invalidateVideoRender(item());
  assert.equal(material.videoPlanState, "已确认");
  assert.equal(material.videoRenderState, "待渲染");
  assert.equal(material.publishingState, "已生成");
});
