import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { validateArtifactManifest } from "../bridge/artifact-validator.mjs";
import { attachManifestSkillEvidence } from "../bridge/skill-adapter.mjs";
import { runCodex } from "../bridge/codex-runner.mjs";

const requestedTask = process.argv[2] ?? "all";
if (!["html", "cover", "all"].includes(requestedTask)) {
  throw new Error("Usage: node scripts/smoke-codex-artifacts.mjs [html|cover|all]");
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const smokeRoot = path.join(projectRoot, "work/a1-smoke");
await mkdir(smokeRoot, { recursive: true });

async function prepareWorkspace(label) {
  const workspace = await mkdtemp(path.join(smokeRoot, `${label}-`));
  await cp(
    path.join(projectRoot, "plugins/creator-content-studio/skills/produce-creator-visuals"),
    path.join(workspace, ".agents/skills/produce-creator-visuals"),
    { recursive: true }
  );
  await cp(path.join(projectRoot, "tests/fixtures/a1"), path.join(workspace, "input"), { recursive: true });
  await mkdir(path.join(workspace, "schemas"), { recursive: true });
  await cp(
    path.join(projectRoot, "schemas/artifact-manifest.schema.json"),
    path.join(workspace, "schemas/artifact-manifest.schema.json")
  );
  execFileSync("git", ["init", "--quiet"], { cwd: workspace });
  return workspace;
}

async function validateReturnedManifest(workspace, result, taskType) {
  const manifestPath = path.join(workspace, "output/manifest.json");
  const diskManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.deepEqual(result.structuredResult, diskManifest, "returned and persisted manifests differ");
  await validateArtifactManifest(workspace, attachManifestSkillEvidence(diskManifest), taskType);
  return diskManifest;
}

async function runHtmlSmoke() {
  const workspace = await prepareWorkspace("html");
  let eventCount = 0;
  const result = await runCodex({
    prompt: [
      "请使用 $produce-creator-visuals Skill 执行 html 视觉制作任务。",
      `已确认内容：${path.join(workspace, "input/confirmed-content.md")}`,
      `风格配置：${path.join(workspace, "input/style-config.json")}`,
      `输出目录：${path.join(workspace, "output")}`,
      "只生成 output/presentation.html 和 output/manifest.json，不生成封面；HTML 根节点包含 data-content-workstation=\"recording-page-v1\"，不引用远程 src 或 href。",
      "manifest 不要添加 Schema 未声明的内部 evidence 字段。",
      "最终只返回与 output/manifest.json 完全相同、且符合指定 Schema 的 JSON。"
    ].join("\n"),
    cwd: workspace,
    schemaPath: path.join(workspace, "schemas/artifact-manifest.schema.json"),
    outputPath: path.join(workspace, ".runner/html-final.json"),
    sandbox: "workspace-write",
    timeoutMs: 5 * 60_000,
    onEvent: () => { eventCount += 1; }
  });
  const manifest = await validateReturnedManifest(workspace, result, "html");
  return { taskType: "html", workspace, threadId: result.threadId, eventCount, manifest };
}

async function runCoverSmoke() {
  const workspace = await prepareWorkspace("cover");
  let eventCount = 0;
  const result = await runCodex({
    prompt: [
      "请使用 $produce-creator-visuals 和 $imagegen Skills 执行 cover 视觉制作任务。",
      `已确认内容：${path.join(workspace, "input/confirmed-content.md")}`,
      `风格配置：${path.join(workspace, "input/style-config.json")}`,
      `输出目录：${path.join(workspace, "output")}`,
      "优先尝试 imagegen 生成不含文字的视觉素材，再用本地排版保证标题准确和三个尺寸精确。",
      "如果 imagegen 不可用或不能提供本地素材，按 Skill 规定使用模板渲染降级，并在 notes 如实说明。",
      "本机可用 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome 和 /usr/bin/sips。",
      "只生成 output/cover-16x9.png（1600×900）、output/cover-4x3.png（1200×900）、output/cover-3x4.png（900×1200）、必要的本地源文件和 output/manifest.json，不生成录屏 HTML。",
      "manifest 不要添加 Schema 未声明的内部 evidence 字段。",
      "最终只返回与 output/manifest.json 完全相同、且符合指定 Schema 的 JSON。"
    ].join("\n"),
    cwd: workspace,
    schemaPath: path.join(workspace, "schemas/artifact-manifest.schema.json"),
    outputPath: path.join(workspace, ".runner/cover-final.json"),
    sandbox: "workspace-write",
    timeoutMs: 10 * 60_000,
    onEvent: () => { eventCount += 1; }
  });
  const manifest = await validateReturnedManifest(workspace, result, "cover");
  return { taskType: "cover", workspace, threadId: result.threadId, eventCount, manifest };
}

const results = [];
if (requestedTask === "html" || requestedTask === "all") results.push(await runHtmlSmoke());
if (requestedTask === "cover" || requestedTask === "all") results.push(await runCoverSmoke());

process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
