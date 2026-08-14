import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function safeFile(workspace, relativePath) {
  assert.equal(path.isAbsolute(relativePath), false);
  const output = path.resolve(workspace, "output");
  const fullPath = path.resolve(workspace, relativePath);
  assert.ok(fullPath.startsWith(`${output}${path.sep}`));
  const info = await lstat(fullPath);
  assert.ok(info.isFile() && !info.isSymbolicLink());
  const [realOutput, realFile] = await Promise.all([realpath(output), realpath(fullPath)]);
  assert.ok(realFile.startsWith(`${realOutput}${path.sep}`));
  return { fullPath, info };
}

export async function validateVideoRenderManifest(workspace, manifest) {
  assert.equal(manifest.manifestVersion, "1.0");
  assert.equal(manifest.taskType, "video-render");
  assert.equal(manifest.generationMode, "remotion-local-render");
  assert.ok((manifest.width === 1920 && manifest.height === 1080) || (manifest.width === 1080 && manifest.height === 1920));
  assert.equal(manifest.fps, 30); assert.ok([900, 9000, 14400].includes(manifest.durationInFrames));
  const expectedDuration = manifest.durationInFrames / manifest.fps;
  assert.ok(manifest.durationSeconds >= expectedDuration - 1 && manifest.durationSeconds <= expectedDuration + 1);
  assert.equal(manifest.artifacts.length, 2);
  const video = manifest.artifacts.find((item) => item.type === "video-mp4");
  const poster = manifest.artifacts.find((item) => item.type === "video-poster");
  assert.ok(video && poster);
  assert.equal(video.path, "output/video.mp4"); assert.equal(video.mimeType, "video/mp4");
  assert.equal(poster.path, "output/video-poster.png"); assert.equal(poster.mimeType, "image/png");
  for (const artifact of manifest.artifacts) {
    assert.equal(artifact.width, manifest.width); assert.equal(artifact.height, manifest.height);
    const { fullPath, info } = await safeFile(workspace, artifact.path);
    const buffer = await readFile(fullPath);
    assert.equal(info.size, artifact.size);
    assert.equal(createHash("sha256").update(buffer).digest("hex"), artifact.sha256);
  }
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height:format=duration", "-of", "json", path.join(workspace, video.path)]);
  const probed = JSON.parse(stdout);
  const stream = probed.streams.find((item) => item.width && item.height);
  assert.deepEqual({ width: Number(stream.width), height: Number(stream.height) }, { width: manifest.width, height: manifest.height });
  assert.ok(Number(probed.format.duration) >= expectedDuration - 1 && Number(probed.format.duration) <= expectedDuration + 1);
  const png = await readFile(path.join(workspace, poster.path));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), manifest.width); assert.equal(png.readUInt32BE(20), manifest.height);
  return manifest;
}
