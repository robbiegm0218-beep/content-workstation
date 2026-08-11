import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanTrackedFiles } from "../scripts/check-private-data.mjs";

test("local distribution exposes a single startup command and first-run documentation", async () => {
  const [packageJson, launcher, readme] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.equal(packageJson.scripts["dev:local"], "node scripts/dev-local.mjs");
  assert.match(launcher, /bridge\/server\.mjs/);
  assert.match(launcher, /\["run", "dev"\]/);
  assert.match(launcher, /SIGINT/);
  assert.match(launcher, /SIGTERM/);
  assert.match(readme, /npm install --global @openai\/codex/);
  assert.match(readme, /codex login/);
  assert.match(readme, /npm run doctor/);
  assert.match(readme, /npm run dev:local/);
});

test("CI uses Fake Runner tests and real Codex smoke tests require explicit confirmation", async () => {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const [packageJson, workflow] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
  ]);

  assert.equal(packageJson.scripts["test:ci"], "npm run check:privacy && npm run lint && npm test");
  assert.equal(packageJson.scripts["smoke:codex"], "node scripts/smoke-codex-local.mjs");
  assert.match(workflow, /npm run test:ci/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.doesNotMatch(workflow, /smoke:codex|test:codex/);

  const help = spawnSync(process.execPath, ["scripts/smoke-codex-local.mjs", "--help"], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /必须显式添加 --yes/);

  const unconfirmed = spawnSync(process.execPath, ["scripts/smoke-codex-local.mjs", "content"], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(unconfirmed.status, 2);
  assert.match(unconfirmed.stderr, /尚未执行/);
});

test("privacy scan rejects tracked local data, user paths, and credential-shaped values", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-privacy-"));
  await mkdir(path.join(root, ".data"), { recursive: true });
  await writeFile(path.join(root, ".data/bridge-token"), "local token");
  const fakeUserPath = ["", "Users", "example", "private"].join("/");
  const fakeKey = ["sk", "1234567890abcdefghijklmnop"].join("-");
  await writeFile(path.join(root, "example.txt"), `path=${fakeUserPath}\nkey=${fakeKey}\n`);
  spawnSync("git", ["init", "--quiet"], { cwd: root });
  spawnSync("git", ["add", ".data/bridge-token", "example.txt", "--force"], { cwd: root });

  const report = await scanTrackedFiles(root);
  assert.ok(report.findings.some((finding) => finding.rule === "local-data"));
  assert.ok(report.findings.some((finding) => finding.rule === "codex-auth"));
  assert.ok(report.findings.some((finding) => finding.rule === "absolute-user-path"));
  assert.ok(report.findings.some((finding) => finding.rule === "openai-style-key"));
});
