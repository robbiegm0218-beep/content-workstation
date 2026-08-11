import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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

  assert.equal(packageJson.scripts["test:ci"], "npm run lint && npm test");
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
