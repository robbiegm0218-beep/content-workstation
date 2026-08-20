import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const pluginRoot = path.join(projectRoot, "plugins/creator-content-studio");

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(1, 4)], [80, 78, 71]);
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("market manifest exposes consistent public brand and HTTPS policy links", async () => {
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(manifest.interface.displayName, "创作者内容工作室");
  assert.equal(manifest.interface.developerName, "Content Workstation");
  assert.equal(manifest.author.name, "Content Workstation");
  assert.doesNotMatch(`${manifest.interface.displayName} ${manifest.interface.developerName}`, /OpenAI|ChatGPT|Codex Official/iu);
  for (const field of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) assert.match(manifest.interface[field], /^https:\/\//u);
  assert.equal(manifest.interface.defaultPrompt.length, 3);
  assert.ok(manifest.interface.defaultPrompt.every((prompt) => prompt.length <= 128));
});

test("market screenshots are three real 1440 by 900 PNG files", async () => {
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(manifest.interface.screenshots.length, 3);
  for (const relativePath of manifest.interface.screenshots) {
    const buffer = await readFile(path.resolve(pluginRoot, relativePath));
    assert.deepEqual(pngDimensions(buffer), { width: 1440, height: 900 });
    assert.ok(buffer.length > 20_000, `${relativePath} is unexpectedly small`);
  }
});

test("support, privacy, terms and submission evidence are present and capability-aligned", async () => {
  const [home, support, privacy, terms, listing, evidence, notes, checklist, pagesWorkflow] = await Promise.all([
    "docs/index.html", "docs/support.html", "docs/privacy.html", "docs/terms.html",
    "submission/marketplace-listing.md", "submission/test-evidence.md", "submission/release-notes.md", "submission/submission-checklist.md",
    ".github/workflows/pages.yml",
  ].map((relativePath) => readFile(path.join(projectRoot, relativePath), "utf8")));
  assert.match(home, /Skills-only/u);
  assert.match(support, /GitHub Issues/u);
  assert.match(privacy, /不运营独立后端/u);
  assert.match(terms, /不自动发布内容/u);
  assert.match(listing, /能力边界/u);
  assert.match(evidence, /6 个正向能力/u);
  assert.match(notes, /已知边界/u);
  assert.match(checklist, /需账号所有者完成/u);
  assert.match(pagesWorkflow, /actions\/configure-pages@v5/u);
  assert.match(pagesWorkflow, /actions\/upload-pages-artifact@v4/u);
  assert.match(pagesWorkflow, /actions\/deploy-pages@v4/u);
  assert.match(pagesWorkflow, /path: docs/u);
  assert.doesNotMatch([home, support, privacy, terms, listing, evidence, notes].join("\n"), /(?:sk-[A-Za-z0-9_-]{20,}|\/Users\/|\bTODO\b)/u);
});
