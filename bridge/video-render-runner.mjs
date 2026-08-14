import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CodexRunError } from "./codex-runner.mjs";

const eventPrefix = "CW_RENDER_EVENT ";

function createRenderEventCollector(onEvent) {
  let buffer = "";
  const events = [];
  const logs = [];
  const accept = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith(eventPrefix)) { logs.push(trimmed); return; }
    try {
      const event = JSON.parse(trimmed.slice(eventPrefix.length));
      events.push(event);
      onEvent(event);
    } catch (error) {
      logs.push(`Invalid renderer event: ${error.message}`);
    }
  };
  return {
    push(chunk) {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      lines.forEach(accept);
    },
    finish() {
      if (buffer) accept(buffer);
      return { events, logs };
    }
  };
}

function terminate(child, signalName) {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") child.kill(signalName);
    else process.kill(-child.pid, signalName);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function rendererEnvironment() {
  return Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));
}

export async function runVideoRender({ workspace, projectRoot, signal, timeoutMs = 15 * 60_000, onEvent = () => {} }) {
  if (signal?.aborted) throw new CodexRunError("Video render was cancelled before start", { reason: "cancelled" });
  const script = path.join(projectRoot, "video-renderer/scripts/render-workspace.mjs");
  const collector = createRenderEventCollector(onEvent);
  let stderr = "";
  const exit = await new Promise((resolve, reject) => {
    let settled = false;
    let stopReason = null;
    let timeoutHandle;
    let forceHandle;
    const child = spawn(process.execPath, [script, workspace], { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32", env: rendererEnvironment() });
    const cleanup = () => { clearTimeout(timeoutHandle); clearTimeout(forceHandle); signal?.removeEventListener("abort", cancel); };
    const stop = (reason) => { if (stopReason || child.exitCode !== null) return; stopReason = reason; terminate(child, "SIGTERM"); forceHandle = setTimeout(() => terminate(child, "SIGKILL"), 3000); forceHandle.unref(); };
    const cancel = () => stop("cancelled");
    timeoutHandle = setTimeout(() => stop("timeout"), timeoutMs); timeoutHandle.unref();
    signal?.addEventListener("abort", cancel, { once: true });
    child.stdout.on("data", (chunk) => collector.push(chunk));
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => { if (settled) return; settled = true; cleanup(); reject(new CodexRunError(`Unable to start video renderer: ${error.message}`, { cause: error })); });
    child.once("close", (code, exitSignal) => { if (settled) return; settled = true; cleanup(); resolve({ code, signal: exitSignal, stopReason }); });
  });
  const parsed = collector.finish();
  if (exit.stopReason) throw new CodexRunError(exit.stopReason === "timeout" ? "Video render timed out" : "Video render was cancelled", { reason: exit.stopReason, stderr, ...parsed });
  if (exit.code !== 0) throw new CodexRunError(`Video renderer exited with code ${exit.code}: ${stderr.slice(-2000)}`, { stderr, ...parsed });
  return JSON.parse(await readFile(path.join(workspace, "output/manifest.json"), "utf8"));
}
