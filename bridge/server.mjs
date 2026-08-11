import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createBridgeConfig, TERMINAL_RUN_STATUSES } from "./config.mjs";
import { runDoctor } from "./doctor.mjs";
import { openRegisteredArtifact } from "./artifact-access.mjs";
import { RunStore } from "./run-store.mjs";
import {
  HttpError,
  assertAllowedOrigin,
  assertBearerToken,
  isLoopbackAddress,
  loadOrCreateBridgeToken,
  readJsonBody,
  validateContinueRunInput,
  validateCreateRunInput
} from "./security.mjs";
import { TaskManager } from "./task-manager.mjs";
import { WorkspaceManager } from "./workspace-manager.mjs";
import { WorkstationStateStore } from "./workstation-state-store.mjs";
import { buildContentBundle } from "./content-bundle.mjs";

function publicRun(record) {
  if (!record) return null;
  const safeRecord = { ...record };
  delete safeRecord.workspace;
  return safeRecord;
}

function setCommonHeaders(response, origin) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
}

function sendJson(response, status, payload, origin = null) {
  setCommonHeaders(response, origin);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload)}\n`);
}

function matchPath(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? match.slice(1).map(decodeURIComponent) : null;
}

export async function createBridgeRuntime(options = {}) {
  const config = createBridgeConfig(options.config);
  const token = options.token ?? await loadOrCreateBridgeToken(config.tokenPath);
  const store = options.store ?? new RunStore(config);
  const workspaceManager = options.workspaceManager ?? new WorkspaceManager(config);
  const workstationStateStore = options.workstationStateStore ?? new WorkstationStateStore(config);
  const taskManager = options.taskManager ?? new TaskManager({
    config,
    store,
    workspaceManager,
    runner: options.runner
  });
  await taskManager.initialize();

  const server = createServer(async (request, response) => {
    let origin = null;
    try {
      if (!isLoopbackAddress(request.socket.remoteAddress)) {
        throw new HttpError(403, "REMOTE_FORBIDDEN", "Bridge only accepts loopback connections");
      }
      origin = assertAllowedOrigin(request, config.allowedOrigins);
      const url = new URL(request.url, `http://${config.host}:${config.port}`);

      if (request.method === "OPTIONS") {
        setCommonHeaders(response, origin);
        response.statusCode = 204;
        response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/health") {
        sendJson(response, 200, {
          ok: true,
          version: config.version,
          host: config.host,
          port: config.port,
          activeRuns: taskManager.activeCount
        }, origin);
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/session") {
        if (!origin) throw new HttpError(403, "ORIGIN_REQUIRED", "Bridge session requires an allowed browser origin");
        sendJson(response, 200, { token, version: config.version }, origin);
        return;
      }

      assertBearerToken(request, token);

      if (request.method === "POST" && url.pathname === "/v1/doctor") {
        sendJson(response, 200, await (options.doctor ?? runDoctor)(config, { bridgeIsListening: true }), origin);
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/runs") {
        sendJson(response, 200, { runs: taskManager.list().map(publicRun) }, origin);
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/workstation-state") {
        sendJson(response, 200, { state: await workstationStateStore.read() }, origin);
        return;
      }

      if (request.method === "PUT" && url.pathname === "/v1/workstation-state") {
        const body = await readJsonBody(request, config.maxBodyBytes);
        sendJson(response, 200, { state: await workstationStateStore.write(body) }, origin);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/exports/content-package") {
        const body = await readJsonBody(request, config.maxBodyBytes);
        const bundle = await buildContentBundle(body, taskManager);
        setCommonHeaders(response, origin);
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/zip");
        response.setHeader("Content-Length", bundle.buffer.length);
        response.setHeader("Content-Disposition", "attachment; filename=content-package.zip");
        response.setHeader("X-Content-Workstation-Files", bundle.fileCount);
        response.end(bundle.buffer);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/runs") {
        const body = await readJsonBody(request, config.maxBodyBytes);
        const input = validateCreateRunInput(body);
        const record = await taskManager.createRun(input);
        sendJson(response, 202, { run: publicRun(record) }, origin);
        return;
      }

      const runMatch = matchPath(url.pathname, /^\/v1\/runs\/([^/]+)$/);
      if (request.method === "GET" && runMatch) {
        const record = taskManager.get(runMatch[0]);
        if (!record) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found");
        sendJson(response, 200, { run: publicRun(record) }, origin);
        return;
      }

      const cancelMatch = matchPath(url.pathname, /^\/v1\/runs\/([^/]+)\/cancel$/);
      if (request.method === "POST" && cancelMatch) {
        const record = await taskManager.cancelRun(cancelMatch[0]);
        sendJson(response, 200, { run: publicRun(record) }, origin);
        return;
      }

      const continueMatch = matchPath(url.pathname, /^\/v1\/runs\/([^/]+)\/continue$/);
      if (request.method === "POST" && continueMatch) {
        const body = await readJsonBody(request, config.maxBodyBytes);
        const continuation = validateContinueRunInput(body);
        const record = await taskManager.continueRun(continueMatch[0], continuation);
        sendJson(response, 202, { run: publicRun(record) }, origin);
        return;
      }

      const eventsMatch = matchPath(url.pathname, /^\/v1\/runs\/([^/]+)\/events$/);
      if (request.method === "GET" && eventsMatch) {
        setCommonHeaders(response, origin);
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        response.setHeader("Connection", "keep-alive");
        response.flushHeaders();
        const unsubscribe = await taskManager.subscribe(eventsMatch[0], (event) => {
          response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        });
        const keepAlive = setInterval(() => response.write(": keep-alive\n\n"), 15_000);
        keepAlive.unref();
        const cleanup = () => {
          clearInterval(keepAlive);
          unsubscribe();
        };
        request.once("close", cleanup);
        const current = taskManager.get(eventsMatch[0]);
        if (current && TERMINAL_RUN_STATUSES.has(current.status)) {
          setImmediate(() => response.end());
        }
        return;
      }

      const manifestMatch = matchPath(url.pathname, /^\/v1\/artifacts\/([^/]+)\/manifest$/);
      if (request.method === "GET" && manifestMatch) {
        const record = taskManager.get(manifestMatch[0]);
        if (!record) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found");
        if (!record.artifactManifest) throw new HttpError(409, "ARTIFACTS_NOT_READY", "Artifacts are not ready");
        sendJson(response, 200, record.artifactManifest, origin);
        return;
      }

      const fileMatch = matchPath(url.pathname, /^\/v1\/artifacts\/([^/]+)\/file\/([^/]+)$/);
      if (request.method === "GET" && fileMatch) {
        const record = taskManager.get(fileMatch[0]);
        if (!record) throw new HttpError(404, "RUN_NOT_FOUND", "Run not found");
        const opened = await openRegisteredArtifact(record, fileMatch[1]);
        setCommonHeaders(response, origin);
        response.statusCode = 200;
        response.setHeader("Content-Type", opened.artifact.mimeType);
        response.setHeader("Content-Length", opened.size);
        response.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(opened.artifact.id)}"`);
        opened.stream.pipe(response);
        return;
      }

      throw new HttpError(404, "NOT_FOUND", "Endpoint not found");
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      const status = error instanceof HttpError ? error.status : 500;
      const code = error instanceof HttpError ? error.code : "INTERNAL_ERROR";
      sendJson(response, status, { error: { code, message: error.message } }, origin);
    }
  });

  server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"));

  return {
    config,
    token,
    server,
    taskManager,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.port, config.host, resolve);
      });
      return server.address();
    },
    async close() {
      await taskManager.shutdown();
      if (server.listening) await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function main() {
  const runtime = await createBridgeRuntime();
  await runtime.listen();
  process.stdout.write(`Content Workstation Bridge ${runtime.config.version}\n`);
  process.stdout.write(`Listening on http://${runtime.config.host}:${runtime.config.port}\n`);
  process.stdout.write(`Token file: ${runtime.config.tokenPath}\n`);

  const shutdown = async () => {
    await runtime.close();
    process.exitCode = 0;
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
