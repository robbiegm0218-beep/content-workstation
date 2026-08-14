import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const schemaDirectory = path.resolve(import.meta.dirname, "../schemas");
const schemaFiles = [
  "content-result.schema.json",
  "topic-angles.schema.json",
  "topic-research.schema.json",
  "artifact-manifest.schema.json",
  "video-scene-plan.schema.json",
  "video-render-manifest.schema.json",
];

function verifyExplicitTypes(node, location = "$") {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  if (Object.hasOwn(node, "const") || Object.hasOwn(node, "enum")) {
    assert.ok(node.type, `${location} uses const/enum without an explicit type`);
  }
  for (const [key, value] of Object.entries(node)) verifyExplicitTypes(value, `${location}.${key}`);
}

test("structured output schemas declare explicit types for constants and enums", async () => {
  for (const file of schemaFiles) {
    const schema = JSON.parse(await readFile(path.join(schemaDirectory, file), "utf8"));
    verifyExplicitTypes(schema, file);
  }
});
