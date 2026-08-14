import path from "node:path";
import { fileURLToPath } from "node:url";

export const BRIDGE_VERSION = "0.1.0";
export const BRIDGE_HOST = "127.0.0.1";
export const DEFAULT_BRIDGE_PORT = 4317;
export const MINIMUM_VALIDATED_CODEX_VERSION = "0.146.0-alpha.9.2";
export const SUPPORTED_TASK_TYPES = new Set(["research", "angles", "content", "html", "cover", "publishing", "video-plan", "video-render"]);
export const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled", "timeout", "interrupted"]);

const bridgeDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultProjectRoot = path.resolve(bridgeDirectory, "..");

export function createBridgeConfig(overrides = {}) {
  const projectRoot = path.resolve(overrides.projectRoot ?? defaultProjectRoot);
  const port = Number(overrides.port ?? process.env.CONTENT_WORKSTATION_BRIDGE_PORT ?? DEFAULT_BRIDGE_PORT);
  const testEphemeralPort = overrides.port === 0;
  if (!Number.isInteger(port) || (!testEphemeralPort && port < 1) || port > 65_535) throw new Error("Invalid Bridge port");

  return {
    version: BRIDGE_VERSION,
    host: BRIDGE_HOST,
    port,
    projectRoot,
    dataRoot: path.resolve(overrides.dataRoot ?? path.join(projectRoot, ".data")),
    workRoot: path.resolve(overrides.workRoot ?? path.join(projectRoot, "work/runs")),
    tokenPath: path.resolve(overrides.tokenPath ?? path.join(projectRoot, ".data/bridge-token")),
    allowedOrigins: overrides.allowedOrigins ?? new Set([
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]),
    maxBodyBytes: overrides.maxBodyBytes ?? 2 * 1024 * 1024,
    maxConcurrentRuns: overrides.maxConcurrentRuns ?? 1,
    taskTimeoutMs: {
      research: 8 * 60_000,
      angles: 5 * 60_000,
      content: 8 * 60_000,
      html: 8 * 60_000,
      cover: 12 * 60_000,
      publishing: 8 * 60_000,
      "video-plan": 8 * 60_000,
      "video-render": 2 * 60 * 60_000,
      ...overrides.taskTimeoutMs
    }
  };
}
