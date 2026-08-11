import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateArtifactManifest } from "./artifact-validator.mjs";

export function createTaskSpecification(input, workspace, timeoutMs) {
  const taskPath = path.join(workspace, "input/task.json");

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
  if (input.taskType === "content") {
    if (structuredResult.generationMeta?.skillEvidence !== "CW-SKILL-1.0") {
      throw new Error("Content result is missing repository Skill evidence");
    }
    const artifactPath = path.join(workspace, "output/content-result.json");
    const buffer = await readFile(artifactPath);
    return {
      manifestVersion: "1.0",
      taskType: "content",
      generationMode: "codex-structured",
      artifacts: [{
        id: "content-result",
        type: "content-json",
        path: "output/content-result.json",
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
