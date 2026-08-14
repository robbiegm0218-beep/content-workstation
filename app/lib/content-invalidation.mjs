function clearPending(prefix) {
  return {
    [`pending${prefix}RunId`]: "",
    [`pending${prefix}Manifest`]: null,
  };
}

export function invalidatePublishing(item) {
  return {
    ...item,
    publishingState: item.publishingState === "未开始" ? "未开始" : "待生成",
    publishingRunId: "",
    publishingManifest: null,
    ...clearPending("Publishing"),
  };
}

export function invalidateVideoRender(item) {
  if (!item.videoEnabled) return item;
  return {
    ...item,
    videoRenderState: "待渲染",
    videoRenderError: "",
    videoRenderRunId: "",
    videoRenderManifest: null,
    ...clearPending("VideoRender"),
  };
}

export function invalidateVideoPlan(item) {
  if (!item.videoEnabled) return item;
  return invalidateVideoRender({
    ...item,
    videoPlanState: "待生成",
    videoPlanRunId: "",
    videoPlan: null,
    pendingVideoPlanRunId: "",
    pendingVideoPlan: null,
  });
}

export function invalidateHtml(item) {
  return {
    ...item,
    htmlState: item.htmlState === "未开始" ? "未开始" : "待生成",
    htmlRunId: "",
    htmlManifest: null,
    ...clearPending("Html"),
  };
}

export function invalidateCover(item) {
  return {
    ...item,
    coverState: item.coverState === "未开始" ? "未开始" : "待生成",
    coverRunId: "",
    coverManifest: null,
    ...clearPending("Cover"),
  };
}

export function invalidateFromContent(item) {
  return invalidateVideoPlan(invalidatePublishing(invalidateCover(invalidateHtml(item))));
}

export function invalidateFromHtml(item) {
  const downstream = invalidatePublishing(item);
  return downstream.videoEnabled && downstream.videoSource === "accepted-html" ? invalidateVideoPlan(downstream) : downstream;
}

export function invalidateFromCover(item) {
  return invalidatePublishing(item);
}
