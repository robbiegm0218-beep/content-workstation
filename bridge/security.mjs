import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_TASK_TYPES } from "./config.mjs";
import { validateVideoPlanSemantics } from "./video-plan-validator.mjs";

const allowedCreateRunKeys = new Set([
  "contentId",
  "taskType",
  "contentVersion",
  "instruction",
  "creatorContext",
  "contentBrief",
  "confirmedContent",
  "styleConfig",
  "acceptedHtml",
  "scenePlan",
  "assetIds",
  "audioAssetId",
  "captionsAssetId"
]);

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function isLoopbackAddress(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

export function assertAllowedOrigin(request, allowedOrigins) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    throw new HttpError(403, "ORIGIN_FORBIDDEN", "Request origin is not allowed");
  }
  return origin ?? null;
}

export function assertBearerToken(request, expectedToken) {
  const authorization = request.headers.authorization ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expectedToken);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    throw new HttpError(401, "UNAUTHORIZED", "A valid local Bridge token is required");
  }
}

export async function loadOrCreateBridgeToken(tokenPath) {
  await mkdir(path.dirname(tokenPath), { recursive: true, mode: 0o700 });
  try {
    return (await readFile(tokenPath, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const token = randomBytes(32).toString("base64url");
  try {
    const handle = await open(tokenPath, "wx", 0o600);
    await handle.writeFile(`${token}\n`);
    await handle.close();
    return token;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return (await readFile(tokenPath, "utf8")).trim();
  }
}

export async function readJsonBody(request, maxBodyBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
}

function assertPlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_INPUT", `${field} must be an object`);
  }
}

export function validateCreateRunInput(input) {
  assertPlainObject(input, "request body");
  for (const key of Object.keys(input)) {
    if (!allowedCreateRunKeys.has(key)) {
      throw new HttpError(400, "UNKNOWN_FIELD", `Unsupported field: ${key}`);
    }
  }
  if (!SUPPORTED_TASK_TYPES.has(input.taskType)) {
    throw new HttpError(400, "UNSUPPORTED_TASK_TYPE", "taskType is not supported");
  }
  if (typeof input.contentId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(input.contentId)) {
    throw new HttpError(400, "INVALID_CONTENT_ID", "contentId contains unsupported characters");
  }
  if (!Number.isInteger(input.contentVersion) || input.contentVersion < 1) {
    throw new HttpError(400, "INVALID_CONTENT_VERSION", "contentVersion must be a positive integer");
  }
  if (input.instruction !== undefined && (typeof input.instruction !== "string" || input.instruction.length > 5_000)) {
    throw new HttpError(400, "INVALID_INSTRUCTION", "instruction must be at most 5000 characters");
  }

  if (input.taskType === "research" || input.taskType === "angles" || input.taskType === "content") {
    assertPlainObject(input.creatorContext, "creatorContext");
    assertPlainObject(input.contentBrief, "contentBrief");
  } else if (input.taskType === "video-render") {
    assertPlainObject(input.scenePlan, "scenePlan");
    try { validateVideoPlanSemantics(input.scenePlan); } catch (error) { throw new HttpError(400, "INVALID_VIDEO_PLAN", error.message); }
    if (!Array.isArray(input.assetIds) || input.assetIds.length > 30 || input.assetIds.some((id) => typeof id !== "string" || !/^asset-[a-f0-9-]+$/.test(id))) {
      throw new HttpError(400, "INVALID_ASSET_IDS", "assetIds must contain at most 30 registered asset IDs");
    }
    if (new Set(input.assetIds).size !== input.assetIds.length) {
      throw new HttpError(400, "DUPLICATE_ASSET_IDS", "assetIds must not contain duplicates");
    }
    for (const [field, value] of [["audioAssetId", input.audioAssetId], ["captionsAssetId", input.captionsAssetId]]) {
      if (value !== undefined && value !== "" && (typeof value !== "string" || !/^asset-[a-f0-9-]+$/.test(value))) throw new HttpError(400, "INVALID_ASSET_ID", `${field} is invalid`);
      if (value && !input.assetIds.includes(value)) throw new HttpError(400, "ASSET_NOT_REGISTERED_FOR_RUN", `${field} must also appear in assetIds`);
    }
  } else {
    if (typeof input.confirmedContent !== "string" || input.confirmedContent.trim().length === 0) {
      throw new HttpError(400, "CONFIRMED_CONTENT_REQUIRED", "confirmedContent is required for visual tasks");
    }
    assertPlainObject(input.styleConfig, "styleConfig");
    if (input.taskType === "video-plan") {
      const sourceMode = input.styleConfig.sourceMode;
      if (sourceMode !== "direct-content" && sourceMode !== "accepted-html") {
        throw new HttpError(400, "INVALID_VIDEO_SOURCE", "video-plan sourceMode must be direct-content or accepted-html");
      }
      if (input.styleConfig.aspectRatio !== undefined && input.styleConfig.aspectRatio !== "16:9" && input.styleConfig.aspectRatio !== "9:16") {
        throw new HttpError(400, "INVALID_VIDEO_ASPECT", "video-plan aspectRatio must be 16:9 or 9:16");
      }
      if (sourceMode === "accepted-html" && (typeof input.acceptedHtml !== "string" || !input.acceptedHtml.includes("<html"))) {
        throw new HttpError(400, "ACCEPTED_HTML_REQUIRED", "acceptedHtml is required when video-plan uses accepted-html");
      }
      if (typeof input.acceptedHtml === "string" && input.acceptedHtml.length > 1_500_000) {
        throw new HttpError(400, "ACCEPTED_HTML_TOO_LARGE", "acceptedHtml must be at most 1500000 characters");
      }
    }
  }

  return {
    contentId: input.contentId,
    taskType: input.taskType,
    contentVersion: input.contentVersion,
    instruction: input.instruction?.trim() ?? "",
    creatorContext: input.creatorContext ?? null,
    contentBrief: input.contentBrief ?? null,
    confirmedContent: input.confirmedContent ?? null,
    styleConfig: input.styleConfig ?? null,
    acceptedHtml: input.acceptedHtml ?? null,
    scenePlan: input.scenePlan ?? null,
    assetIds: input.assetIds ?? [],
    audioAssetId: input.audioAssetId ?? "",
    captionsAssetId: input.captionsAssetId ?? ""
  };
}

export function validateContinueRunInput(input) {
  assertPlainObject(input, "request body");
  const keys = Object.keys(input);
  if (keys.some((key) => key !== "instruction")) {
    throw new HttpError(400, "UNKNOWN_FIELD", "Continue only accepts instruction");
  }
  if (typeof input.instruction !== "string" || input.instruction.trim().length === 0 || input.instruction.length > 5_000) {
    throw new HttpError(400, "INVALID_INSTRUCTION", "instruction must contain 1 to 5000 characters");
  }
  return { instruction: input.instruction.trim() };
}

export function createMinimalCodexEnvironment(source = process.env) {
  const allowedKeys = [
    "PATH",
    "HOME",
    "USER",
    "SHELL",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "TERM",
    "CODEX_HOME",
    "SSL_CERT_FILE",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY"
  ];
  return Object.fromEntries(allowedKeys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}
