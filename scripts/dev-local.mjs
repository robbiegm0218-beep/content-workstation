import { spawn } from "node:child_process";

const projectRoot = new URL("..", import.meta.url);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Map();
let stopping = false;

function stopProcess(child, signal = "SIGTERM") {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function start(label, command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    detached: process.platform !== "win32"
  });
  children.set(label, child);
  child.once("error", (error) => {
    console.error(`[${label}] 启动失败：${error.message}`);
  });
  child.once("exit", (code, signal) => {
    children.delete(label);
    if (stopping) {
      if (children.size === 0) process.exit(process.exitCode ?? 0);
      return;
    }
    console.error(`[${label}] 已退出（${signal || `code ${code ?? 1}`}），正在停止另一项本地服务。`);
    shutdown(code ?? 1);
  });
  return child;
}

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children.values()) stopProcess(child);
  setTimeout(() => {
    for (const child of children.values()) stopProcess(child, "SIGKILL");
  }, 2_000);
  setTimeout(() => process.exit(exitCode), 2_200);
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

console.log("正在启动内容工作站…");
console.log("启动完成后，请打开 http://localhost:3000/\n");
start("Codex Bridge", process.execPath, ["bridge/server.mjs"]);
start("Web", npmCommand, ["run", "dev"]);
