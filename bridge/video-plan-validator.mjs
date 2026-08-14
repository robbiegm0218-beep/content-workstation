import path from "node:path";

function missingMaterialLabel(materialId, scene) {
  const filename = path.posix.basename(materialId || "未命名素材");
  const sceneLabel = scene?.headline || scene?.id || "未指定场景";
  return `待补素材：${filename}（用于：${sceneLabel}）`.slice(0, 160);
}

export function normalizeGeneratedVideoPlanMaterials(plan, availableMaterials = []) {
  const normalized = structuredClone(plan);
  const allowed = new Set(availableMaterials);
  const missing = Array.isArray(normalized.missingMaterials) ? normalized.missingMaterials.filter((item) => typeof item === "string" && item.trim()).map((item) => item.slice(0, 160)) : [];
  normalized.materials = Array.isArray(normalized.materials) ? normalized.materials.filter((item) => allowed.has(item)) : [];
  normalized.scenes = Array.isArray(normalized.scenes) ? normalized.scenes.map((scene) => {
    const references = Array.isArray(scene.materialIds) ? scene.materialIds : [];
    for (const materialId of references) {
      if (!allowed.has(materialId)) missing.push(missingMaterialLabel(materialId, scene));
    }
    return { ...scene, materialIds: references.filter((materialId) => allowed.has(materialId)) };
  }) : normalized.scenes;
  normalized.missingMaterials = [...new Set(missing)].slice(0, 20);
  return normalized;
}

export function validateVideoPlanSemantics(plan, expectedSource = null) {
  const dimensions = plan?.aspectRatio === "16:9" ? { width: 1920, height: 1080 } : plan?.aspectRatio === "9:16" ? { width: 1080, height: 1920 } : null;
  const supportedDurations = new Set([900, 9000, 14400]);
  if (!plan || plan.schemaVersion !== "1.0" || !dimensions || plan.fps !== 30 || plan.width !== dimensions.width || plan.height !== dimensions.height || !supportedDurations.has(plan.durationInFrames)) {
    throw new Error("Video plan must use a supported 30 second, 5 minute, or 8 minute contract");
  }
  if (!Array.isArray(plan.materials) || plan.materials.length > 20 || plan.materials.some((item) => typeof item !== "string" || !/^assets\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(png|jpe?g|svg|mp3|wav|mp4)$/.test(item))) {
    throw new Error("Video plan contains an invalid material path");
  }
  if (!Array.isArray(plan.scenes) || plan.scenes.length < 2 || plan.scenes.length > 120) throw new Error("Video plan must contain 2 to 120 scenes");
  const sceneIds = new Set();
  const materials = new Set(plan.materials);
  let expectedStart = 0;
  for (const scene of plan.scenes) {
    if (!scene || !/^scene-[a-z0-9-]+$/.test(scene.id) || !Number.isInteger(scene.startFrame) || !Number.isInteger(scene.durationInFrames) || scene.durationInFrames < 30 || scene.durationInFrames > 900 || !Array.isArray(scene.materialIds)) {
      throw new Error("Video plan contains an invalid scene");
    }
    if (sceneIds.has(scene.id)) throw new Error(`Scene id must be unique: ${scene.id}`);
    sceneIds.add(scene.id);
    if (scene.startFrame !== expectedStart) throw new Error(`Scene ${scene.id} must start at frame ${expectedStart}`);
    for (const materialId of scene.materialIds) {
      if (!materials.has(materialId)) throw new Error(`Scene ${scene.id} references undeclared material: ${materialId}`);
    }
    expectedStart += scene.durationInFrames;
  }
  if (expectedStart !== plan.durationInFrames) throw new Error("Scene durations must fill the whole composition");
  if (plan.sourceMode === "direct-content" && (plan.sourceTrace.htmlRunId || plan.sourceTrace.htmlSha256 || plan.sourceTrace.htmlSections.length)) {
    throw new Error("Direct-content plans must keep the HTML source trace empty");
  }
  if (plan.sourceMode === "accepted-html" && (!plan.sourceTrace.htmlRunId || !plan.sourceTrace.htmlSha256 || plan.sourceTrace.htmlSections.length === 0)) {
    throw new Error("Accepted-HTML plans must include a complete source trace");
  }
  if (expectedSource && plan.sourceMode !== expectedSource.sourceMode) {
    throw new Error("Video plan source mode does not match the requested source");
  }
  if (expectedSource?.aspectRatio && plan.aspectRatio !== expectedSource.aspectRatio) {
    throw new Error("Video plan aspect ratio does not match the requested format");
  }
  if (expectedSource?.durationInFrames && plan.durationInFrames !== expectedSource.durationInFrames) {
    throw new Error("Video plan duration does not match the requested format");
  }
  if (expectedSource?.sourceMode === "accepted-html" && (plan.sourceTrace.htmlRunId !== expectedSource.htmlRunId || plan.sourceTrace.htmlSha256 !== expectedSource.htmlSha256)) {
    throw new Error("Video plan HTML source trace does not match the accepted artifact");
  }
  return plan;
}
