import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
