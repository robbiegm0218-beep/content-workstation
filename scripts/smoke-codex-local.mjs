import { spawnSync } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const supportedScopes = new Set(["content", "html", "cover", "bridge", "cancel", "full"]);
const args = process.argv.slice(2);
const helpRequested = args.includes("--help") || args.includes("-h");
const confirmed = args.includes("--yes");
const scope = args.find((value) => !value.startsWith("-")) ?? "content";

function printUsage() {
  process.stdout.write(`
真实 Codex 冒烟测试

用法：
  npm run smoke:codex -- <范围> --yes

范围：
  content  验证仓库 Skill 与结构化内容稿（默认）
  html     验证单文件 HTML 生成与产物校验
  cover    验证三尺寸封面；可能调用图片生成，耗时最长
  bridge   验证 Bridge 内容生成与同一线程续跑
  cancel   验证真实 Codex 进程取消后无残留
  full     依次验证 content、html、cover

该命令会调用当前已登录的真实 Codex 并消耗相应额度，必须显式添加 --yes。
GitHub CI 不运行此命令，只使用 Fake Runner。

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

function commandResult(command, commandArgs) {
  return spawnSync(command, commandArgs, { cwd: projectRoot, encoding: "utf8" });
}

const version = commandResult("codex", ["--version"]);
if (version.status !== 0) {
  process.stderr.write("未找到可用的 Codex CLI。请先安装：npm install --global @openai/codex\n");
  process.exit(1);
}
const login = commandResult("codex", ["login", "status"]);
if (login.status !== 0) {
  process.stderr.write("Codex 尚未登录。请先运行 codex login 并完成浏览器登录。\n");
  process.exit(1);
}

const tasks = {
  content: [["scripts/smoke-codex-content.mjs"]],
  html: [["scripts/smoke-codex-artifacts.mjs", "html"]],
  cover: [["scripts/smoke-codex-artifacts.mjs", "cover"]],
  bridge: [["scripts/smoke-bridge-content.mjs"]],
  cancel: [["scripts/smoke-codex-cancel.mjs"]],
  full: [
    ["scripts/smoke-codex-content.mjs"],
    ["scripts/smoke-codex-artifacts.mjs", "html"],
    ["scripts/smoke-codex-artifacts.mjs", "cover"]
  ]
};

process.stdout.write(`Codex 环境已确认：${version.stdout.trim()}；${login.stdout.trim()}\n`);
process.stdout.write(`开始真实冒烟测试：${scope}\n\n`);

for (const [script, ...scriptArgs] of tasks[scope]) {
  process.stdout.write(`→ ${[script, ...scriptArgs].join(" ")}\n`);
  const result = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.stdout.write(`\n真实 Codex 冒烟测试通过：${scope}\n`);

