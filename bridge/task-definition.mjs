import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateArtifactManifest } from "./artifact-validator.mjs";
import { normalizeGeneratedVideoPlanMaterials, validateVideoPlanSemantics } from "./video-plan-validator.mjs";

export function createTaskSpecification(input, workspace, timeoutMs) {
  const taskPath = path.join(workspace, "input/task.json");

  if (input.taskType === "research") {
    return {
      prompt: [
        "请使用 $content-workstation-creator Skill 执行联网选题调研。",
        `账号资料：${path.join(workspace, "input/creator-context.json")}`,
        `议题简报：${path.join(workspace, "input/content-brief.json")}`,
        `任务补充要求：${taskPath}`,
        "必须使用搜索能力核验公开可访问的信息。每条样本必须带可访问 URL；无法访问的平台明确写入限制和人工补充项。",
        "不得虚构标题、作者、发布时间、互动数据、平台热度或搜索覆盖范围。只总结本次实际找到的样本。",
        "本轮只生成调研结果和三个建议切口，不生成完整内容稿、HTML、封面或发布包。",
        "最终只输出符合指定 JSON Schema 的 JSON。"
      ].join("\n"),
      sandbox: "read-only",
      search: true,
      schemaPath: path.join(workspace, "schemas/topic-research.schema.json"),
      outputPath: path.join(workspace, "output/topic-research.json"),
      timeoutMs
    };
  }

  if (input.taskType === "angles") {
    return {
      prompt: [
        "请使用 $content-workstation-creator Skill 生成选题切入角度。",
        `账号资料：${path.join(workspace, "input/creator-context.json")}`,
        `议题简报：${path.join(workspace, "input/content-brief.json")}`,
        `任务补充要求：${taskPath}`,
        "本轮只生成恰好 3 个差异明确、可用于后续内容创作的切入角度，不生成完整内容稿、HTML、封面或发布包。",
        "只依据输入中的账号资料、议题和案例判断；不虚构平台热度、搜索结果、项目经历或数据。",
        "最终只输出符合指定 JSON Schema 的 JSON。"
      ].join("\n"),
      sandbox: "read-only",
      schemaPath: path.join(workspace, "schemas/topic-angles.schema.json"),
      outputPath: path.join(workspace, "output/topic-angles.json"),
      timeoutMs
    };
  }

  if (input.taskType === "content") {
    return {
      prompt: [
        "请使用 $content-workstation-creator Skill 生成结构化内容稿。",
        `账号资料：${path.join(workspace, "input/creator-context.json")}`,
        `选题简报：${path.join(workspace, "input/content-brief.json")}`,
        `任务补充要求：${taskPath}`,
        "本轮只生成内容稿，不生成 HTML 和封面。",
        "最终只输出符合指定 JSON Schema 的 JSON。"
      ].join("\n"),
      sandbox: "read-only",
      schemaPath: path.join(workspace, "schemas/content-result.schema.json"),
      outputPath: path.join(workspace, "output/content-result.json"),
      timeoutMs
    };
  }

  if (input.taskType === "video-plan") {
    const usesHtml = input.styleConfig?.sourceMode === "accepted-html";
    const aspectRatio = input.styleConfig?.aspectRatio === "9:16" ? "9:16" : "16:9";
    const dimensions = aspectRatio === "9:16" ? "1080×1920" : "1920×1080";
    const durationInFrames = [9000, 14400].includes(input.styleConfig?.durationInFrames) ? input.styleConfig.durationInFrames : 900;
    const durationLabel = durationInFrames === 14400 ? "8 分钟" : durationInFrames === 9000 ? "5 分钟" : "30 秒";
    const sceneCountGuidance = durationInFrames === 14400 ? "建议 40～90 个场景" : durationInFrames === 9000 ? "建议 25～60 个场景" : "建议 4～12 个场景";
    return {
      prompt: [
        "请使用 $content-workstation-creator Skill 执行 video-plan 场景方案任务。",
        `已确认内容：${path.join(workspace, "input/confirmed-content.md")}`,
        `视频配置：${path.join(workspace, "input/style-config.json")}`,
        usesHtml ? `已验收 HTML 快照：${path.join(workspace, "input/accepted-presentation.html")}` : "本次直接根据内容稿规划，不读取 HTML。",
        `任务补充要求：${taskPath}`,
        `严格按口播顺序生成 ${durationLabel}、${aspectRatio}（${dimensions}）、共 ${durationInFrames} 帧的结构化场景方案；${sceneCountGuidance}，所有场景必须连续且时长总和必须精确等于 ${durationInFrames} 帧；不生成 React、HTML、图片或 MP4。`,
        aspectRatio === "9:16" ? "这是独立竖屏编排：控制单屏文字量，优先纵向流程、上下对比与竖屏安全区，不得把横版布局直接裁切。" : "按横屏阅读顺序编排，保持标题、主体和字幕安全区。",
        "每个场景都要填写画面文案、旁白、转场和字幕开关。本任务没有传入已登记素材，因此 materials 和所有 materialIds 必须为空；需要的真实素材只写入 missingMaterials，不得虚构文件路径、项目截图、人物、数据或案例。",
        usesHtml ? "提取 HTML 的章节标题与顺序写入 sourceTrace.htmlSections，并从视频配置读取已接受 HTML 的 runId 与 SHA-256。" : "sourceTrace 的 HTML 字段保持空值。",
        "最终只输出符合指定 JSON Schema 的 JSON。"
      ].join("\n"),
      sandbox: "read-only",
      schemaPath: path.join(workspace, "schemas/video-scene-plan.schema.json"),
      outputPath: path.join(workspace, "output/video-scene-plan.json"),
      timeoutMs
    };
  }

  if (input.taskType === "publishing") {
    return {
      prompt: [
        "请使用 $content-workstation-creator Skill 执行 publishing 发布包任务。",
        `已确认内容：${path.join(workspace, "input/confirmed-content.md")}`,
        `平台与已接受产物配置：${path.join(workspace, "input/style-config.json")}`,
        `任务补充要求：${taskPath}`,
        `输出目录：${path.join(workspace, "output")}`,
        "严格读取 style-config.json 的 platforms，只为其中选中的平台生成发布内容；不要补写未选择的平台。",
        "只生成 output/publishing-package.md 和 output/manifest.json，不修改内容稿、HTML 或封面。",
        "最终只返回与 output/manifest.json 完全相同、且符合指定 Schema 的 JSON。"
      ].join("\n"),
      sandbox: "workspace-write",
      schemaPath: path.join(workspace, "schemas/artifact-manifest.schema.json"),
      outputPath: path.join(workspace, ".runner/final.json"),
      timeoutMs
    };
  }

  const coverInstructions = input.taskType === "cover" ? [
    "请同时使用 $imagegen；优先生成无字视觉素材，再进行本地精确排版。",
    "如果图片能力不可用，按 Skill 规定自动使用模板渲染并如实记录 generationMode。"
  ] : [];

  return {
    prompt: [
      `请使用 $content-workstation-creator Skill 执行 ${input.taskType} 视觉制作任务。`,
      ...coverInstructions,
      `已确认内容：${path.join(workspace, "input/confirmed-content.md")}`,
      `风格配置：${path.join(workspace, "input/style-config.json")}`,
      `任务补充要求：${taskPath}`,
      `输出目录：${path.join(workspace, "output")}`,
      input.taskType === "html" ? "只生成录屏 HTML 和 manifest，不生成封面。" : "只生成三尺寸封面和 manifest，不生成录屏 HTML。",
      "最终只返回与 output/manifest.json 完全相同、且符合指定 Schema 的 JSON。"
    ].join("\n"),
    sandbox: "workspace-write",
    schemaPath: path.join(workspace, "schemas/artifact-manifest.schema.json"),
    outputPath: path.join(workspace, ".runner/final.json"),
    timeoutMs
  };
}

export async function finalizeTaskResult(input, workspace, structuredResult) {
  if (input.taskType === "research" || input.taskType === "angles" || input.taskType === "content" || input.taskType === "video-plan") {
    if (structuredResult.generationMeta?.skillEvidence !== "CW-SKILL-1.0") {
      throw new Error(`${input.taskType} result is missing repository Skill evidence`);
    }
    const isResearch = input.taskType === "research";
    const isAngles = input.taskType === "angles";
    const isVideoPlan = input.taskType === "video-plan";
    if (isVideoPlan) {
      structuredResult = normalizeGeneratedVideoPlanMaterials(structuredResult);
      validateVideoPlanSemantics(structuredResult, input.styleConfig);
      await writeFile(path.join(workspace, "output/video-scene-plan.json"), `${JSON.stringify(structuredResult, null, 2)}\n`, { mode: 0o600 });
    }
    const relativePath = isResearch ? "output/topic-research.json" : isAngles ? "output/topic-angles.json" : isVideoPlan ? "output/video-scene-plan.json" : "output/content-result.json";
    const artifactPath = path.join(workspace, relativePath);
    const buffer = await readFile(artifactPath);
    return {
      manifestVersion: "1.0",
      taskType: input.taskType,
      generationMode: "codex-structured",
      artifacts: [{
        id: isResearch ? "topic-research-result" : isAngles ? "topic-angles-result" : isVideoPlan ? "video-scene-plan" : "content-result",
        type: isResearch ? "topic-research-json" : isAngles ? "topic-angles-json" : isVideoPlan ? "video-scene-plan-json" : "content-json",
        path: relativePath,
        mimeType: "application/json",
        width: null,
        height: null,
        sha256: createHash("sha256").update(buffer).digest("hex")
      }],
      notes: []
    };
  }

  const diskManifest = JSON.parse(await readFile(path.join(workspace, "output/manifest.json"), "utf8"));
  if (JSON.stringify(diskManifest) !== JSON.stringify(structuredResult)) {
    throw new Error("Returned manifest does not match output/manifest.json");
  }
  return validateArtifactManifest(workspace, diskManifest, input.taskType, {
    platforms: input.taskType === "publishing" ? input.styleConfig?.platforms : undefined
  });
}
