import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WorkstationStateStore, validateWorkstationState } from "../../bridge/workstation-state-store.mjs";

const database = (name) => ({ contents: [], cases: [], settings: { name } });

test("state validation preserves old content rows for application-level migration", () => {
  const state = validateWorkstationState({ version: "1.0", database: { contents: [{ id: "legacy", title: "旧内容" }], cases: [], settings: {} } });
  assert.equal(state.database.contents[0].videoEnabled, undefined);
  assert.equal(state.database.contents[0].title, "旧内容");
});

test("state store restores the previous valid snapshot when the primary file is corrupt", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "content-workstation-state-"));
  const store = new WorkstationStateStore({ dataRoot });
  await store.write({ version: "1.0", database: database("first") });
  await store.write({ version: "1.0", database: database("second") });
  await writeFile(store.statePath, "{broken-json");
  const restored = await store.read();
  assert.equal(restored.database.settings.name, "first");
});
