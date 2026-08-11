import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export class CodexRunError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "CodexRunError";
    Object.assign(this, details);
  }
}

function terminateProcessTree(child, signalName) {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform !== "win32") {
      process.kill(-child.pid, signalName);
    } else {
      child.kill(signalName);
    }
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

export function createJsonlCollector(onEvent = () => {}) {
  let buffer = "";
  const events = [];
  const parseErrors = [];
  let threadId = null;
  let lastAgentMessage = null;

  function acceptLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const event = JSON.parse(trimmed);
      events.push(event);
      if (event.type === "thread.started") {
        threadId = event.thread_id ?? event.threadId ?? null;
      }
      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        lastAgentMessage = event.item.text ?? event.item.content ?? null;
      }
      onEvent(event);
    } catch (error) {
      parseErrors.push({ line: trimmed, message: error.message });
    }
  }

  return {
    push(chunk) {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) acceptLine(line);
    },
    finish() {
      if (buffer) acceptLine(buffer);
      buffer = "";
      return { events, parseErrors, threadId, lastAgentMessage };
    }
  };
}

export async function runCodex({
  prompt,
  cwd,
  schemaPath,
  outputPath,
  sandbox = "read-only",
  ephemeral = true,
  codexCommand = "codex",
  commandPrefixArgs = [],
  env = process.env,
  onEvent,
  onStart,
  signal,
  timeoutMs = 0,
  forceKillAfterMs = 2_000,
  resumeThreadId = null
}) {
  if (!prompt?.trim()) throw new TypeError("prompt is required");
  if (!cwd) throw new TypeError("cwd is required");
  if (signal?.aborted) {
    throw new CodexRunError("Codex run was cancelled before start", { reason: "cancelled" });
  }

  const resolvedCwd = path.resolve(cwd);
  const resolvedSchema = schemaPath ? path.resolve(schemaPath) : null;
  const resolvedOutput = outputPath ? path.resolve(outputPath) : null;
  if (resolvedOutput) await mkdir(path.dirname(resolvedOutput), { recursive: true });

  const args = [
    ...commandPrefixArgs,
    "exec",
    "--sandbox",
    sandbox,
    "-C",
    resolvedCwd
  ];
  if (resumeThreadId) args.push("resume");
  args.push("--json");
  if (ephemeral) args.push("--ephemeral");
  if (resolvedSchema) args.push("--output-schema", resolvedSchema);
  if (resolvedOutput) args.push("--output-last-message", resolvedOutput);
  if (resumeThreadId) args.push(resumeThreadId);
  args.push(prompt);

  const collector = createJsonlCollector(onEvent);
  let stderr = "";
  const exit = await new Promise((resolve, reject) => {
    let settled = false;
    let stopReason = null;
    let timeoutHandle = null;
    let forceKillHandle = null;
    const child = spawn(codexCommand, args, {
      cwd: resolvedCwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (forceKillHandle) clearTimeout(forceKillHandle);
      signal?.removeEventListener("abort", cancelRun);
    };
    const stopRun = (reason) => {
      if (stopReason || child.exitCode !== null) return;
      stopReason = reason;
      terminateProcessTree(child, "SIGTERM");
      forceKillHandle = setTimeout(() => terminateProcessTree(child, "SIGKILL"), forceKillAfterMs);
      forceKillHandle.unref();
    };
    const cancelRun = () => stopRun("cancelled");

    onStart?.({ pid: child.pid });
    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => stopRun("timeout"), timeoutMs);
      timeoutHandle.unref();
    }
    signal?.addEventListener("abort", cancelRun, { once: true });

    child.stdout.on("data", (chunk) => collector.push(chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new CodexRunError(`Unable to start Codex: ${error.message}`, { cause: error }));
    });
    child.once("close", (code, exitSignal) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ code, signal: exitSignal, pid: child.pid, stopReason });
    });
  });

  const parsed = collector.finish();
  if (exit.stopReason) {
    const reasonLabel = exit.stopReason === "timeout" ? "timed out" : "was cancelled";
    throw new CodexRunError(`Codex run ${reasonLabel}`, {
      ...exit,
      reason: exit.stopReason,
      stderr,
      ...parsed
    });
  }
  if (exit.code !== 0) {
    throw new CodexRunError(`Codex exited with code ${exit.code}`, {
      ...exit,
      stderr,
      ...parsed
    });
  }
  if (parsed.parseErrors.length > 0) {
    throw new CodexRunError("Codex emitted invalid JSONL", { stderr, ...parsed });
  }

  let structuredResult = null;
  if (resolvedOutput) {
    const rawResult = await readFile(resolvedOutput, "utf8");
    try {
      structuredResult = JSON.parse(rawResult);
    } catch (error) {
      throw new CodexRunError("Codex final output is not valid JSON", {
        cause: error,
        rawResult,
        stderr,
        ...parsed
      });
    }
  }

  return {
    ...exit,
    stderr,
    ...parsed,
    structuredResult,
    outputPath: resolvedOutput
  };
}
