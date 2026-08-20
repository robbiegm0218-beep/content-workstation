import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { runCodex } from "../bridge/codex-runner.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const smokeRoot = path.join(projectRoot, "work/m4-plugin-forward");
const supportedScopes = new Set(["content", "visual", "video", "negative", "all"]);
const args = process.argv.slice(2);
const helpRequested = args.includes("--help") || args.includes("-h");
const confirmed = args.includes("--yes");
const scope = args.find((value) => !value.startsWith("-")) ?? "all";

function printUsage() {
  process.stdout.write(`
插件真实 Codex 前向测试

用法：
  npm run test:plugin:codex -- [content|visual|video|negative|all] --yes

每个用例都在全新隔离目录中运行，只复制当前用例需要的公开 Skill。
该命令会调用已登录的真实 Codex 并消耗额度，必须显式添加 --yes。

`);
}

if (helpRequested) {
  printUsage();
  process.exit(0);
}
if (!supportedScopes.has(scope)) {
  printUsage();
  process.stderr.write(`不支持的测试范围：${scope}\n`);
  process.exit(2);
}
if (!confirmed) {
  printUsage();
  process.stderr.write("尚未执行：请确认愿意调用真实 Codex 后添加 --yes。\n");
  process.exit(2);
}

for (const commandArgs of [["--version"], ["login", "status"]]) {
  const check = spawnSync("codex", commandArgs, { cwd: projectRoot, encoding: "utf8" });
  if (check.status !== 0) {
    process.stderr.write(commandArgs[0] === "--version" ? "未找到可用的 Codex CLI。\n" : "Codex 尚未登录。\n");
    process.exit(1);
  }
}

await mkdir(smokeRoot, { recursive: true });

async function prepareWorkspace(label, skills) {
  const workspace = await mkdtemp(path.join(smokeRoot, `${label}-`));
  for (const skill of skills) {
    await cp(
      path.join(projectRoot, "plugins/creator-content-studio/skills", skill),
      path.join(workspace, ".agents/skills", skill),
      { recursive: true },
    );
  }
  const initialized = spawnSync("git", ["init", "--quiet"], { cwd: workspace, encoding: "utf8" });
  if (initialized.status !== 0) throw new Error(`Unable to initialize forward-test workspace: ${initialized.stderr}`);
  return workspace;
}

const cases = {
  content: {
    skills: ["create-creator-content"],
    prompt: [
      "请使用 $create-creator-content Skill，以对话模式生成一份简短的视频内容框架。",
      "通用测试背景：一名企业服务产品经理，受众是正在转型 AI 产品的产品经理。",
      "选题：为什么 RAG 评测不能只看一个总分。",
      "我只说有项目经历，没有提供客户、指标和结果；请明确列为待补充，不得虚构。",
      "本轮不生成 HTML、封面或文件。",
    ].join("\n"),
    verify(text) {
      assert.match(text, /待补充|需要补充/u);
      assert.match(text, /场景|问题|判断/u);
      assert.doesNotMatch(text, /某知名|提升\s*\d+%|降低\s*\d+%/u);
    },
  },
  visual: {
    skills: ["produce-creator-visuals"],
    prompt: [
      "请使用 $produce-creator-visuals Skill，以对话模式返回封面设计稿。",
      "已确认标题：RAG 评测，别只看总分。核心观点：先拆分问题类型，再定位链路节点。",
      "当前没有图片生成能力，也不允许写文件。",
      "请只返回 16:9、4:3、3:4 三个独立构图的可执行方案，如实说明没有生成 PNG。",
    ].join("\n"),
    verify(text) {
      assert.match(text, /16:9/u);
      assert.match(text, /4:3/u);
      assert.match(text, /3:4/u);
      assert.match(text, /未生成|没有生成|不会生成/u);
      assert.doesNotMatch(text, /(?:已生成|生成完成).{0,20}\.png/iu);
    },
  },
  video: {
    skills: ["plan-creator-video"],
    prompt: [
      "请使用 $plan-creator-video Skill，以对话模式生成可编辑视频场景表。",
      "已确认内容：RAG 评测不能只看总分，需要把失败对话定位到查询改写、召回、排序或生成节点。",
      "目标是 16:9、30 秒，目前没有截图、音频或字幕文件。",
      "请给出场景、时长、画面文案、旁白、转场和待补素材；不生成或声称渲染 MP4。",
    ].join("\n"),
    verify(text) {
      assert.match(text, /场景|Scene/iu);
      assert.match(text, /时长|秒/u);
      assert.match(text, /待补素材|缺失素材/u);
      assert.doesNotMatch(text, /(?:已|已经)(?:完成)?(?:渲染|导出).{0,12}MP4/iu);
    },
  },
  negative: {
    skills: ["create-creator-content", "produce-creator-visuals", "plan-creator-video"],
    prompt: "这是一个普通编程问题：请解释 React 列表中 key 属性的作用。不修改文件，用两句话回答。",
    verify(text, result) {
      assert.match(text, /React|key/u);
      const events = JSON.stringify(result.events);
      assert.doesNotMatch(events, /\.agents\/skills\/(?:create-creator-content|produce-creator-visuals|plan-creator-video)/u);
    },
  },
};

const selected = scope === "all" ? ["content", "visual", "video", "negative"] : [scope];
const results = [];
for (const caseName of selected) {
  const definition = cases[caseName];
  const workspace = await prepareWorkspace(caseName, definition.skills);
  let eventCount = 0;
  const result = await runCodex({
    prompt: definition.prompt,
    cwd: workspace,
    sandbox: "read-only",
    ephemeral: true,
    timeoutMs: 5 * 60_000,
    onEvent: () => { eventCount += 1; },
  });
  const text = result.lastAgentMessage ?? "";
  assert.ok(result.threadId, `${caseName}: missing thread id`);
  assert.ok(text.length > 20, `${caseName}: missing final response`);
  definition.verify(text, result);
  results.push({ caseName, threadId: result.threadId, eventCount, workspace, responseLength: text.length });
  process.stdout.write(`通过：${caseName}\n`);
}

process.stdout.write(`${JSON.stringify({ ok: true, isolated: true, results }, null, 2)}\n`);
