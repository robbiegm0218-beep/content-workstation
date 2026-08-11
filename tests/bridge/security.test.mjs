import assert from "node:assert/strict";
import test from "node:test";
import { createMinimalCodexEnvironment, validateCreateRunInput } from "../../bridge/security.mjs";

const contentInput = {
  contentId: "content-001",
  taskType: "content",
  contentVersion: 1,
  creatorContext: { voice: "practical" },
  contentBrief: { title: "RAG" }
};

test("run input rejects unknown command-like fields", () => {
  assert.throws(
    () => validateCreateRunInput({ ...contentInput, codexArgs: ["--dangerously-bypass-approvals-and-sandbox"] }),
    /Unsupported field/
  );
  assert.throws(
    () => validateCreateRunInput({ ...contentInput, taskType: "shell" }),
    /taskType must be/
  );
});

test("visual tasks require confirmed content and style configuration", () => {
  assert.throws(
    () => validateCreateRunInput({
      contentId: "content-001",
      taskType: "cover",
      contentVersion: 1,
      styleConfig: {}
    }),
    /confirmedContent is required/
  );
  assert.doesNotThrow(() => validateCreateRunInput({
    contentId: "content-001",
    taskType: "publishing",
    contentVersion: 1,
    confirmedContent: "approved content",
    styleConfig: { platforms: ["B站", "小红书", "视频号", "抖音"] }
  }));
});

test("topic angle tasks use creator context and a content brief", () => {
  assert.doesNotThrow(() => validateCreateRunInput({
    ...contentInput,
    contentId: "angles-001",
    taskType: "angles"
  }));
  assert.throws(
    () => validateCreateRunInput({
      contentId: "angles-001",
      taskType: "angles",
      contentVersion: 1,
      creatorContext: {}
    }),
    /contentBrief must be an object/
  );
});

test("topic research tasks use the same bounded structured input", () => {
  assert.doesNotThrow(() => validateCreateRunInput({
    ...contentInput,
    contentId: "research-001",
    taskType: "research"
  }));
  assert.throws(
    () => validateCreateRunInput({
      contentId: "research-001",
      taskType: "research",
      contentVersion: 1,
      contentBrief: {}
    }),
    /creatorContext must be an object/
  );
});

test("Codex receives a minimal environment without unrelated secrets", () => {
  const environment = createMinimalCodexEnvironment({
    PATH: "/bin",
    HOME: "/tmp/example-home",
    CODEX_HOME: "/tmp/codex-home",
    DEEPSEEK_API_KEY: "secret",
    RANDOM_TOKEN: "secret"
  });
  assert.deepEqual(environment, {
    PATH: "/bin",
    HOME: "/tmp/example-home",
    CODEX_HOME: "/tmp/codex-home"
  });
});
