import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateArtifactManifest } from "../../bridge/artifact-validator.mjs";

function createHtmlManifest(html, artifactPath = "output/presentation.html") {
  return {
    manifestVersion: "1.0",
    skillEvidence: "CW-SKILL-1.0",
    taskType: "html",
    generationMode: "codex-html",
    artifacts: [{
      id: "recording-page",
      type: "recording-html",
      path: artifactPath,
      mimeType: "text/html",
      width: null,
      height: null,
      sha256: createHash("sha256").update(html).digest("hex")
    }],
    notes: []
  };
}

test("artifact validator accepts a self-contained recording page", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "content-workstation-artifact-"));
  const output = path.join(workspace, "output");
  await mkdir(output);
  const html = '<!doctype html><html data-content-workstation="recording-page-v1"><body>ok</body></html>';
  await writeFile(path.join(output, "presentation.html"), html);

  await validateArtifactManifest(workspace, createHtmlManifest(html), "html");
});

test("artifact validator rejects paths that escape output", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "content-workstation-artifact-"));
  await mkdir(path.join(workspace, "output"));
  const html = '<html data-content-workstation="recording-page-v1"></html>';
  await writeFile(path.join(workspace, "outside.html"), html);

  await assert.rejects(
    validateArtifactManifest(workspace, createHtmlManifest(html, "output/../outside.html"), "html"),
    /inside output/
  );
});

test("artifact validator accepts a complete four-platform publishing package", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "content-workstation-publishing-"));
  const output = path.join(workspace, "output");
  await mkdir(output);
  const markdown = "# 发布包\n\n## B站\n内容\n\n## 小红书\n内容\n\n## 视频号\n内容\n\n## 抖音\n内容\n";
  await writeFile(path.join(output, "publishing-package.md"), markdown);
  const manifest = {
    manifestVersion: "1.0",
    skillEvidence: "CW-SKILL-1.0",
    taskType: "publishing",
    generationMode: "codex-publishing",
    artifacts: [{
      id: "publishing-package",
      type: "publishing-package",
      path: "output/publishing-package.md",
      mimeType: "text/markdown",
      width: null,
      height: null,
      sha256: createHash("sha256").update(markdown).digest("hex")
    }],
    notes: []
  };

  await validateArtifactManifest(workspace, manifest, "publishing");
});

test("artifact validator accepts a publishing package for only the selected platform", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "content-workstation-publishing-single-"));
  const output = path.join(workspace, "output");
  await mkdir(output);
  const markdown = "# B站发布包\n\n## B站\n标题、简介、章节与标签\n";
  await writeFile(path.join(output, "publishing-package.md"), markdown);
  const manifest = {
    manifestVersion: "1.0",
    skillEvidence: "CW-SKILL-1.0",
    taskType: "publishing",
    generationMode: "codex-publishing",
    artifacts: [{
      id: "publishing-package",
      type: "publishing-package",
      path: "output/publishing-package.md",
      mimeType: "text/markdown",
      width: null,
      height: null,
      sha256: createHash("sha256").update(markdown).digest("hex")
    }],
    notes: []
  };

  await validateArtifactManifest(workspace, manifest, "publishing", { platforms: ["B站"] });
});
