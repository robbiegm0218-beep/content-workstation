import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CodexRunError, createJsonlCollector, runCodex } from "../../bridge/codex-runner.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const fakeCodex = path.join(projectRoot, "tests/fixtures/fake-codex.mjs");
const fakeCodexHang = path.join(projectRoot, "tests/fixtures/fake-codex-hang.mjs");

test("JSONL collector handles split lines and extracts the thread id", () => {
  const collector = createJsonlCollector();
  collector.push('{"type":"thread.started","thread_id":"abc');
  collector.push('123"}\n{"type":"item.completed","item":{"type":"agent_message","text":"done"}}\n');
  const result = collector.finish();
  assert.equal(result.threadId, "abc123");
  assert.equal(result.lastAgentMessage, "done");
  assert.equal(result.events.length, 2);
  assert.deepEqual(result.parseErrors, []);
});

test("runner reports successful completion", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "content-workstation-runner-"));
  const result = await runCodex({
    prompt: "fixture",
    cwd,
    codexCommand: process.execPath,
    commandPrefixArgs: [fakeCodex],
    outputPath: null
  });
  assert.equal(result.code, 0);
  assert.equal(result.threadId, "thread-test-001");
  assert.equal(result.lastAgentMessage, '{"ok":true}');
});

test("runner enables Codex web search before the exec subcommand", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "content-workstation-runner-"));
  const argsPath = path.join(cwd, "args.json");
  await runCodex({
    prompt: "fixture",
    cwd,
    codexCommand: process.execPath,
    commandPrefixArgs: [fakeCodex],
    outputPath: null,
    search: true,
    env: { ...process.env, FAKE_CODEX_ARGS_PATH: argsPath }
  });
  const args = JSON.parse(await readFile(argsPath, "utf8"));
  assert.ok(args.indexOf("--search") >= 0);
  assert.ok(args.indexOf("--search") < args.indexOf("exec"));
});

test("runner preserves JSONL context for failed completion", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "content-workstation-runner-"));
  await assert.rejects(
    runCodex({
      prompt: "fixture",
      cwd,
      codexCommand: process.execPath,
      commandPrefixArgs: [fakeCodex],
      outputPath: null,
      env: { ...process.env, FAKE_CODEX_EXIT: "2" }
    }),
    (error) => {
      assert.ok(error instanceof CodexRunError);
      assert.equal(error.code, 2);
      assert.equal(error.threadId, "thread-test-001");
      assert.equal(error.events.at(-1).type, "turn.failed");
      return true;
    }
  );
});

test("runner cancels the process after an AbortSignal", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "content-workstation-runner-"));
  const controller = new AbortController();
  let pid;

  await assert.rejects(
    runCodex({
      prompt: "fixture",
      cwd,
      codexCommand: process.execPath,
      commandPrefixArgs: [fakeCodexHang],
      outputPath: null,
      signal: controller.signal,
      onStart: (processInfo) => {
        pid = processInfo.pid;
        setTimeout(() => controller.abort(), 40);
      }
    }),
    (error) => {
      assert.ok(error instanceof CodexRunError);
      assert.equal(error.reason, "cancelled");
      assert.equal(error.pid, pid);
      return true;
    }
  );

  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
});

test("runner terminates a process after its timeout", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "content-workstation-runner-"));
  let pid;

  await assert.rejects(
    runCodex({
      prompt: "fixture",
      cwd,
      codexCommand: process.execPath,
      commandPrefixArgs: [fakeCodexHang],
      outputPath: null,
      timeoutMs: 60,
      onStart: (processInfo) => {
        pid = processInfo.pid;
      }
    }),
    (error) => {
      assert.ok(error instanceof CodexRunError);
      assert.equal(error.reason, "timeout");
      assert.equal(error.pid, pid);
      return true;
    }
  );

  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
});
