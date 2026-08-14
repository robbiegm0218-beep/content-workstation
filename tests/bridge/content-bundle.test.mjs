import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildContentBundle, createZipBuffer, validateContentBundleInput } from "../../bridge/content-bundle.mjs";

test("content bundle creates a valid stored ZIP with named files", () => {
  const zip = createZipBuffer([
    { name: "README.txt", data: Buffer.from("说明") },
    { name: "covers/cover-16x9.png", data: Buffer.from([1, 2, 3, 4]) },
  ]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), 2);
  assert.match(zip.toString("utf8"), /README\.txt/);
  assert.match(zip.toString("utf8"), /covers\/cover-16x9\.png/);
});

test("content bundle input rejects untrusted run ids", () => {
  assert.throws(() => validateContentBundleInput({
    contentId: "content-001",
    title: "RAG flow",
    subtitle: "",
    platforms: ["B站"],
    script: "content",
    runIds: { html: "../../outside" },
  }), /run id is invalid/);
});

test("content bundle includes HTML by stable artifact type when its id varies", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "content-bundle-html-"));
  await mkdir(path.join(workspace, "output"));
  await writeFile(path.join(workspace, "output/presentation.html"), "<html>recording</html>");
  const record = {
    runId: "run-a1b2c3",
    contentId: "content-001",
    taskType: "html",
    status: "completed",
    workspace,
    artifactManifest: {
      artifacts: [{ id: "recording-presentation", type: "recording-html", path: "output/presentation.html" }]
    }
  };
  const { buffer, fileCount } = await buildContentBundle({
    contentId: "content-001",
    title: "RAG flow",
    subtitle: "",
    platforms: ["B站"],
    script: "content",
    runIds: { html: record.runId },
  }, { get: (runId) => runId === record.runId ? record : null });
  assert.equal(fileCount, 3);
  assert.match(buffer.toString("utf8"), /recording\/presentation\.html/);
});

test("content bundle independently includes an accepted video plan, MP4, and poster", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "content-bundle-video-"));
  await mkdir(path.join(workspace, "output"));
  await writeFile(path.join(workspace, "output/video.mp4"), Buffer.from("fake-mp4-for-bundle"));
  await writeFile(path.join(workspace, "output/video-poster.png"), Buffer.from("fake-poster-for-bundle"));
  const scenePlan = JSON.parse(await readFile(new URL("../../video-renderer/fixtures/sample-scene-plan.json", import.meta.url), "utf8"));
  const record = {
    runId: "run-a1b2c3d4",
    contentId: "content-001",
    taskType: "video-render",
    status: "completed",
    workspace,
    artifactManifest: {
      artifacts: [
        { id: "video-mp4", type: "video-mp4", path: "output/video.mp4" },
        { id: "video-poster", type: "video-poster", path: "output/video-poster.png" },
      ],
    },
  };
  const { buffer, fileCount } = await buildContentBundle({
    contentId: "content-001",
    title: "RAG flow",
    subtitle: "",
    platforms: ["B站"],
    script: "content",
    videoPlan: scenePlan,
    runIds: { "video-render": record.runId },
  }, { get: (runId) => runId === record.runId ? record : null });
  assert.equal(fileCount, 5);
  const names = buffer.toString("utf8");
  assert.match(names, /video\/video-scene-plan\.json/);
  assert.match(names, /video\/video\.mp4/);
  assert.match(names, /video\/video-poster\.png/);
});
