import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBridgeConfig } from "../../bridge/config.mjs";
import { RunStore } from "../../bridge/run-store.mjs";

test("run store marks unfinished tasks interrupted after restart", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-store-"));
  const config = createBridgeConfig({
    projectRoot: path.resolve(import.meta.dirname, "../.."),
    dataRoot: path.join(root, ".data"),
    workRoot: path.join(root, "work")
  });
  const firstStore = new RunStore(config);
  await firstStore.initialize();
  await firstStore.create({
    runId: "run-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const restartedStore = new RunStore(config);
  await restartedStore.initialize();
  const recovered = restartedStore.get("run-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assert.equal(recovered.status, "interrupted");
  assert.equal(recovered.error.code, "BRIDGE_RESTARTED");
});
