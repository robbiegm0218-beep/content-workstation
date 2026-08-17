import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { BRIDGE_SKILL_EVIDENCE } from "./skill-adapter.mjs";

const expectedCovers = new Map([
  ["cover-16x9", { path: "output/cover-16x9.png", width: 1600, height: 900 }],
  ["cover-4x3", { path: "output/cover-4x3.png", width: 1200, height: 900 }],
  ["cover-3x4", { path: "output/cover-3x4.png", width: 900, height: 1200 }]
]);

function readPngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  assert.equal(buffer.subarray(0, 8).toString("hex"), signature, "invalid PNG signature");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR", "PNG has no IHDR header");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function resolveSafeArtifact(workspace, relativePath) {
  assert.equal(path.isAbsolute(relativePath), false, "artifact path must be relative");
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
  assert.ok(normalized.startsWith("output/"), "artifact must be inside output/");
  assert.equal(normalized.includes("../"), false, "artifact path traversal is forbidden");

  const outputRoot = path.resolve(workspace, "output");
  const fullPath = path.resolve(workspace, ...normalized.split("/"));
  assert.ok(fullPath.startsWith(`${outputRoot}${path.sep}`), "artifact escaped output/");
  const stat = await lstat(fullPath);
  assert.equal(stat.isFile(), true, "artifact must be a regular file");
  assert.equal(stat.isSymbolicLink(), false, "artifact symlinks are forbidden");
  const resolvedFile = await realpath(fullPath);
  const resolvedRoot = await realpath(outputRoot);
  assert.ok(resolvedFile.startsWith(`${resolvedRoot}${path.sep}`), "artifact real path escaped output/");
  return fullPath;
}

export async function validateArtifactManifest(workspace, manifest, expectedTaskType, options = {}) {
  assert.equal(manifest.manifestVersion, "1.0");
  assert.equal(manifest.skillEvidence, BRIDGE_SKILL_EVIDENCE);
  assert.equal(manifest.taskType, expectedTaskType);

  if (expectedTaskType === "html") {
    assert.equal(manifest.generationMode, "codex-html");
    assert.equal(manifest.artifacts.length, 1);
  } else if (expectedTaskType === "cover") {
    assert.ok(
      ["codex-imagegen-hybrid", "codex-template-render"].includes(manifest.generationMode),
      "unexpected cover generation mode"
    );
    assert.equal(manifest.artifacts.length, 3);
  } else {
    assert.equal(expectedTaskType, "publishing");
    assert.equal(manifest.generationMode, "codex-publishing");
    assert.equal(manifest.artifacts.length, 1);
  }

  for (const artifact of manifest.artifacts) {
    const fullPath = await resolveSafeArtifact(workspace, artifact.path);
    const buffer = await readFile(fullPath);
    const digest = createHash("sha256").update(buffer).digest("hex");
    assert.equal(artifact.sha256, digest, `sha256 mismatch for ${artifact.path}`);

    if (expectedTaskType === "html") {
      assert.equal(artifact.type, "recording-html");
      assert.equal(artifact.path, "output/presentation.html");
      assert.equal(artifact.mimeType, "text/html");
      assert.equal(artifact.width, null);
      assert.equal(artifact.height, null);
      const html = buffer.toString("utf8");
      assert.match(html, /<html[^>]*data-content-workstation=["']recording-page-v1["']/i);
      assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']https?:\/\//i);
    } else if (expectedTaskType === "cover") {
      const expected = expectedCovers.get(artifact.type);
      assert.ok(expected, `unexpected cover type ${artifact.type}`);
      assert.equal(artifact.path, expected.path);
      assert.equal(artifact.mimeType, "image/png");
      const dimensions = readPngDimensions(buffer);
      assert.deepEqual(dimensions, { width: expected.width, height: expected.height });
      assert.equal(artifact.width, expected.width);
      assert.equal(artifact.height, expected.height);
    } else {
      assert.equal(artifact.type, "publishing-package");
      assert.equal(artifact.path, "output/publishing-package.md");
      assert.equal(artifact.mimeType, "text/markdown");
      assert.equal(artifact.width, null);
      assert.equal(artifact.height, null);
      const markdown = buffer.toString("utf8");
      const selectedPlatforms = Array.isArray(options.platforms) && options.platforms.length
        ? options.platforms
        : ["B站", "小红书", "视频号", "抖音"];
      for (const platform of selectedPlatforms) assert.match(markdown, new RegExp(platform), `publishing package is missing ${platform}`);
      for (const platform of ["B站", "小红书", "视频号", "抖音"].filter((item) => !selectedPlatforms.includes(item))) {
        assert.doesNotMatch(markdown, new RegExp(`^#{1,3}\\s*${platform}(?:\\s|$)`, "m"), `publishing package contains unselected ${platform} section`);
      }
    }
  }

  return manifest;
}
