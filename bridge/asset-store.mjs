import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./security.mjs";

const allowedTypes = new Map([
  ["image/png", { extension: ".png", kind: "image", maxBytes: 25 * 1024 * 1024 }],
  ["image/jpeg", { extension: ".jpg", kind: "image", maxBytes: 25 * 1024 * 1024 }],
  ["image/svg+xml", { extension: ".svg", kind: "image", maxBytes: 2 * 1024 * 1024 }],
  ["audio/mpeg", { extension: ".mp3", kind: "audio", maxBytes: 50 * 1024 * 1024 }],
  ["audio/wav", { extension: ".wav", kind: "audio", maxBytes: 100 * 1024 * 1024 }],
  ["video/mp4", { extension: ".mp4", kind: "video", maxBytes: 150 * 1024 * 1024 }],
  ["text/vtt", { extension: ".vtt", kind: "captions", maxBytes: 2 * 1024 * 1024 }],
  ["application/x-subrip", { extension: ".srt", kind: "captions", maxBytes: 2 * 1024 * 1024 }],
  ["text/plain", { extension: ".srt", kind: "captions", maxBytes: 2 * 1024 * 1024 }]
]);

function assertId(value, field) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)) {
    throw new HttpError(400, "INVALID_ASSET_ID", `${field} contains unsupported characters`);
  }
}

function decodeBase64(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new HttpError(400, "INVALID_ASSET_DATA", "asset data must be canonical base64");
  }
  return Buffer.from(value, "base64");
}

function assertSafeSvg(buffer) {
  const svg = buffer.toString("utf8");
  if (!/<svg[\s>]/i.test(svg) || /<script|on\w+\s*=|(?:href|src)\s*=\s*["']?(?:https?:|data:|file:|\/\/)/i.test(svg)) {
    throw new HttpError(400, "UNSAFE_SVG", "SVG scripts, event handlers, and external resources are forbidden");
  }
}

export class AssetStore {
  constructor(config) {
    this.root = path.resolve(config.dataRoot, "assets");
  }

  async initialize() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }

  contentDirectory(contentId) {
    assertId(contentId, "contentId");
    const directory = path.resolve(this.root, contentId);
    if (!directory.startsWith(`${this.root}${path.sep}`)) throw new HttpError(400, "UNSAFE_ASSET_PATH", "asset path escaped storage");
    return directory;
  }

  async create({ contentId, name, mimeType, dataBase64 }) {
    const format = allowedTypes.get(mimeType);
    if (!format) throw new HttpError(400, "UNSUPPORTED_ASSET_TYPE", "asset type is not allowed");
    if (typeof name !== "string" || !name.trim() || name.length > 180) throw new HttpError(400, "INVALID_ASSET_NAME", "asset name is required");
    const buffer = decodeBase64(dataBase64);
    if (!buffer.length || buffer.length > format.maxBytes) throw new HttpError(413, "ASSET_SIZE_INVALID", `asset must be between 1 and ${format.maxBytes} bytes`);
    if (mimeType === "image/svg+xml") assertSafeSvg(buffer);
    const directory = this.contentDirectory(contentId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const assetId = `asset-${randomUUID()}`;
    const filename = `${assetId}${format.extension}`;
    const createdAt = new Date().toISOString();
    const metadata = { assetId, contentId, name: path.basename(name), mimeType, kind: format.kind, size: buffer.length, filename, relativePath: `assets/${filename}`, createdAt };
    await writeFile(path.join(directory, filename), buffer, { mode: 0o600, flag: "wx" });
    await writeFile(path.join(directory, `${assetId}.json`), `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    return metadata;
  }

  async list(contentId) {
    const directory = this.contentDirectory(contentId);
    let files;
    try { files = await readdir(directory); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    const records = await Promise.all(files.filter((file) => /^asset-[a-f0-9-]+\.json$/.test(file)).map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8"))));
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(contentId, assetId) {
    assertId(assetId, "assetId");
    const directory = this.contentDirectory(contentId);
    let metadata;
    try { metadata = JSON.parse(await readFile(path.join(directory, `${assetId}.json`), "utf8")); } catch (error) { if (error.code === "ENOENT") throw new HttpError(404, "ASSET_NOT_FOUND", "asset not found"); throw error; }
    if (metadata.contentId !== contentId || metadata.assetId !== assetId) throw new HttpError(500, "ASSET_METADATA_MISMATCH", "asset metadata is inconsistent");
    const filePath = path.join(directory, metadata.filename);
    const info = await stat(filePath);
    if (!info.isFile() || info.size !== metadata.size) throw new HttpError(500, "ASSET_FILE_INVALID", "asset file is invalid");
    return { metadata, filePath };
  }

  async copyTo(contentId, assetId, destinationDirectory) {
    const { metadata, filePath } = await this.get(contentId, assetId);
    await mkdir(destinationDirectory, { recursive: true, mode: 0o700 });
    await cp(filePath, path.join(destinationDirectory, metadata.filename), { errorOnExist: true });
    return metadata;
  }

  async delete(contentId, assetId) {
    const { metadata, filePath } = await this.get(contentId, assetId);
    await rm(filePath);
    await rm(path.join(this.contentDirectory(contentId), `${assetId}.json`));
    return metadata;
  }
}
