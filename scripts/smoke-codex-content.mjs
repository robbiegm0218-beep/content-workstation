import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { runCodex } from "../bridge/codex-runner.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const smokeRoot = path.join(projectRoot, "work/a0-smoke");
await mkdir(smokeRoot, { recursive: true });
const workspace = await mkdtemp(path.join(smokeRoot, "workspace-"));
const skillTarget = path.join(workspace, ".agents/skills/create-creator-content");
const fixturesTarget = path.join(workspace, "input");
const schemaTarget = path.join(workspace, "schemas/content-result.schema.json");

await cp(path.join(projectRoot, "plugins/creator-content-studio/skills/create-creator-content"), skillTarget, { recursive: true });
await cp(path.join(projectRoot, "tests/fixtures/a0"), fixturesTarget, { recursive: true });
await mkdir(path.dirname(schemaTarget), { recursive: true });
await cp(path.join(projectRoot, "schemas/content-result.schema.json"), schemaTarget);
execFileSync("git", ["init", "--quiet"], { cwd: workspace });

const creatorPath = path.join(fixturesTarget, "creator-context.json");
const briefPath = path.join(fixturesTarget, "content-brief.json");
const outputPath = path.join(workspace, "output/content-result.json");

const prompt = [
  "请使用 $create-creator-content Skill 完成一次结构化内容稿验证。",
  `账号资料：${creatorPath}`,
  `选题简报：${briefPath}`,
  "读取这两个文件并严格遵守仓库 Skill。",
  "本轮只生成内容稿，不生成 HTML 和封面。",
  "最终只输出符合指定 JSON Schema 的 JSON。"
].join("\n");

let eventCount = 0;
const result = await runCodex({
  prompt,
  cwd: workspace,
  schemaPath: schemaTarget,
  outputPath,
  onEvent: () => {
    eventCount += 1;
  }
});

const content = result.structuredResult;
if (!result.threadId) throw new Error("Missing thread id in Codex JSONL stream");
if (content.generationMeta?.skillName !== "create-creator-content") {
  throw new Error("Public content Skill identity is missing");
}
if (content.subtitleCandidates?.length !== 3) {
  throw new Error("Expected exactly three subtitle candidates");
}
if (!content.subtitleCandidates.some((item) => item.title === content.recommendedSubtitle)) {
  throw new Error("Recommended subtitle is not one of the candidates");
}
for (const platform of ["bilibili", "xiaohongshu", "wechatChannels", "douyin"]) {
  if (!content.platformPackages?.[platform]?.title) {
    throw new Error(`Missing platform package: ${platform}`);
  }
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  threadId: result.threadId,
  eventCount,
  skillName: content.generationMeta.skillName,
  subtitleCandidates: content.subtitleCandidates.length,
  timelineItems: content.timeline.length,
  workspace,
  outputPath: result.outputPath
}, null, 2)}\n`);
