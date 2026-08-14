import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AssetStore } from "../../bridge/asset-store.mjs";

async function createStore() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "content-workstation-assets-"));
  const store = new AssetStore({ dataRoot });
  await store.initialize();
  return { store, dataRoot };
}

test("asset store registers, lists, copies, and deletes a local asset", async () => {
  const { store, dataRoot } = await createStore();
  const bytes = Buffer.from("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n开始\n");
  const asset = await store.create({ contentId: "content-asset", name: "captions.vtt", mimeType: "text/vtt", dataBase64: bytes.toString("base64") });
  assert.equal(asset.kind, "captions");
  assert.equal((await store.list("content-asset")).length, 1);
  const destination = path.join(dataRoot, "copied");
  await store.copyTo("content-asset", asset.assetId, destination);
  assert.deepEqual(await readFile(path.join(destination, asset.filename)), bytes);
  await store.delete("content-asset", asset.assetId);
  assert.equal((await store.list("content-asset")).length, 0);
  await assert.rejects(store.get("content-asset", asset.assetId), /not found/);
});

test("asset store rejects unsupported content and active SVG payloads", async () => {
  const { store } = await createStore();
  await assert.rejects(store.create({ contentId: "content-asset", name: "payload.exe", mimeType: "application/octet-stream", dataBase64: Buffer.from("x").toString("base64") }), /not allowed/);
  await assert.rejects(store.create({ contentId: "content-asset", name: "unsafe.svg", mimeType: "image/svg+xml", dataBase64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64") }), /scripts/);
});
