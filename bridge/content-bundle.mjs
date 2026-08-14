import { HttpError } from "./security.mjs";
import { openRegisteredArtifact } from "./artifact-access.mjs";
import { validateVideoPlanSemantics } from "./video-plan-validator.mjs";

const PLATFORM_NAMES = new Set(["B站", "小红书", "视频号", "抖音"]);
const RUN_TYPES = ["html", "cover", "publishing", "video-render"];
const FILE_NAMES = {
  "recording-html": "recording/presentation.html",
  "cover-16x9": "covers/cover-16x9.png",
  "cover-4x3": "covers/cover-4x3.png",
  "cover-3x4": "covers/cover-3x4.png",
  "publishing-package": "publishing/publishing-package.md",
  "video-mp4": "video/video.mp4",
  "video-poster": "video/video-poster.png",
};

function assertPlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_EXPORT_INPUT", `${field} must be an object`);
  }
}

export function validateContentBundleInput(input) {
  assertPlainObject(input, "request body");
  const allowedKeys = new Set(["contentId", "title", "subtitle", "platforms", "script", "runIds", "videoPlan"]);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) throw new HttpError(400, "UNKNOWN_FIELD", `Unsupported field: ${key}`);
  }
  if (typeof input.contentId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(input.contentId)) {
    throw new HttpError(400, "INVALID_CONTENT_ID", "contentId contains unsupported characters");
  }
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 200) {
    throw new HttpError(400, "INVALID_EXPORT_TITLE", "title must contain 1 to 200 characters");
  }
  if (input.subtitle !== undefined && (typeof input.subtitle !== "string" || input.subtitle.length > 300)) {
    throw new HttpError(400, "INVALID_EXPORT_SUBTITLE", "subtitle must be at most 300 characters");
  }
  if (typeof input.script !== "string" || input.script.length > 1_000_000) {
    throw new HttpError(400, "INVALID_EXPORT_SCRIPT", "script must be a string of at most 1000000 characters");
  }
  if (!Array.isArray(input.platforms) || input.platforms.some((item) => !PLATFORM_NAMES.has(item))) {
    throw new HttpError(400, "INVALID_EXPORT_PLATFORMS", "platforms contains an unsupported value");
  }
  assertPlainObject(input.runIds, "runIds");
  for (const key of Object.keys(input.runIds)) {
    if (!RUN_TYPES.includes(key)) throw new HttpError(400, "UNKNOWN_FIELD", `Unsupported run type: ${key}`);
  }
  for (const key of RUN_TYPES) {
    const value = input.runIds[key];
    if (value !== undefined && value !== "" && (typeof value !== "string" || !/^run-[a-f0-9-]+$/.test(value))) {
      throw new HttpError(400, "INVALID_RUN_ID", `${key} run id is invalid`);
    }
  }
  if (input.videoPlan !== undefined && input.videoPlan !== null) {
    assertPlainObject(input.videoPlan, "videoPlan");
    try {
      validateVideoPlanSemantics(input.videoPlan);
    } catch (error) {
      throw new HttpError(400, "INVALID_VIDEO_PLAN", error.message);
    }
  }
  return {
    contentId: input.contentId,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() ?? "",
    platforms: [...input.platforms],
    script: input.script,
    runIds: Object.fromEntries(RUN_TYPES.map((key) => [key, input.runIds[key] || ""])),
    videoPlan: input.videoPlan ? structuredClone(input.videoPlan) : null,
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function createZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosTimestamp();

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function buildContentBundle(input, taskManager) {
  const data = validateContentBundleInput(input);
  const files = [];
  if (data.script.trim()) files.push({ name: "content/content-script.md", data: Buffer.from(data.script, "utf8") });
  if (data.videoPlan) files.push({ name: "video/video-scene-plan.json", data: Buffer.from(`${JSON.stringify(data.videoPlan, null, 2)}\n`, "utf8") });

  for (const taskType of RUN_TYPES) {
    const runId = data.runIds[taskType];
    if (!runId) continue;
    const record = taskManager.get(runId);
    if (!record) throw new HttpError(404, "RUN_NOT_FOUND", `${taskType} run not found`);
    if (record.contentId !== data.contentId || record.taskType !== taskType || record.status !== "completed" || !record.artifactManifest) {
      throw new HttpError(409, "EXPORT_ASSET_MISMATCH", `${taskType} run is not an accepted completed artifact for this content`);
    }
    for (const artifact of record.artifactManifest.artifacts) {
      const fileName = FILE_NAMES[artifact.type];
      if (!fileName) continue;
      const opened = await openRegisteredArtifact(record, artifact.id);
      files.push({ name: fileName, data: await streamToBuffer(opened.stream) });
    }
  }

  if (!files.length) throw new HttpError(409, "NO_EXPORTABLE_ASSETS", "No accepted content or assets are available to export");
  const readme = [
    "内容工作站 · 本期完整交付包",
    "",
    `标题：${data.title}`,
    data.subtitle ? `副标题：${data.subtitle}` : "",
    `发布平台：${data.platforms.join("、") || "未设置"}`,
    `导出时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
    "",
    "目录说明：",
    "- content/content-script.md：已确认内容稿",
    "- recording/presentation.html：HTML 录屏页面（如已验收）",
    "- video/video-scene-plan.json：已确认视频场景方案（如已确认）",
    "- video/video.mp4：Remotion 动态视频成片（如已验收）",
    "- video/video-poster.png：动态视频 poster（如已验收）",
    "- covers/：16:9、4:3、3:4 三尺寸封面（如已验收）",
    "- publishing/publishing-package.md：平台发布文案（如已验收）",
    "",
    "本压缩包只收录工作站中当前已验收的产物。",
  ].filter(Boolean).join("\n");
  files.unshift({ name: "README.txt", data: Buffer.from(readme, "utf8") });
  return { buffer: createZipBuffer(files), fileCount: files.length };
}
