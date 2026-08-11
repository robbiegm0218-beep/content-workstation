import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { CodexRunError, runCodex } from "../bridge/codex-runner.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const smokeRoot = path.join(projectRoot, "work/a1-cancel");
await mkdir(smokeRoot, { recursive: true });
const workspace = await mkdtemp(path.join(smokeRoot, "workspace-"));
execFileSync("git", ["init", "--quiet"], { cwd: workspace });

const controller = new AbortController();
let pid;
let abortScheduled = false;

try {
  await runCodex({
    prompt: "检查当前空工作区并简要说明你看到的内容。",
    cwd: workspace,
    outputPath: null,
    sandbox: "read-only",
    signal: controller.signal,
    onStart: (processInfo) => { pid = processInfo.pid; },
    onEvent: (event) => {
      if (!abortScheduled && event.type === "turn.started") {
        abortScheduled = true;
        setTimeout(() => controller.abort(), 50);
      }
    }
  });
  throw new Error("Expected the real Codex process to be cancelled");
} catch (error) {
  if (!(error instanceof CodexRunError) || error.reason !== "cancelled") throw error;
  let processAlive = true;
  try {
    process.kill(pid, 0);
  } catch (killError) {
    if (killError.code !== "ESRCH") throw killError;
    processAlive = false;
  }
  if (processAlive) throw new Error(`Codex process ${pid} is still alive after cancellation`);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    reason: error.reason,
    pid,
    threadId: error.threadId,
    processAlive,
    workspace
  }, null, 2)}\n`);
}
