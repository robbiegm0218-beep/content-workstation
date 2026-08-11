import { appendFile, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { TERMINAL_RUN_STATUSES } from "./config.mjs";

export class RunStore {
  constructor(config) {
    this.runsRoot = path.join(config.dataRoot, "runs");
    this.records = new Map();
    this.writeChains = new Map();
  }

  async initialize() {
    await mkdir(this.runsRoot, { recursive: true, mode: 0o700 });
    const entries = await readdir(this.runsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^run-[a-f0-9-]+$/.test(entry.name)) continue;
      try {
        const record = JSON.parse(await readFile(path.join(this.runsRoot, entry.name, "run.json"), "utf8"));
        if (!TERMINAL_RUN_STATUSES.has(record.status)) {
          record.status = "interrupted";
          record.completedAt = new Date().toISOString();
          record.error = { code: "BRIDGE_RESTARTED", message: "Bridge restarted before the task completed" };
          await this.#writeRecord(record);
        }
        this.records.set(record.runId, record);
      } catch {
        // Ignore malformed directories; Doctor and logs can surface them without crashing startup.
      }
    }
  }

  list() {
    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(runId) {
    return this.records.get(runId) ?? null;
  }

  async create(record) {
    if (this.records.has(record.runId)) throw new Error("Run already exists");
    this.records.set(record.runId, structuredClone(record));
    await this.#writeRecord(record);
    return this.get(record.runId);
  }

  async update(runId, patch) {
    const current = this.get(runId);
    if (!current) throw new Error("Run not found");
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.records.set(runId, next);
    await this.#writeRecord(next);
    return next;
  }

  async appendEvent(runId, event) {
    const runDirectory = path.join(this.runsRoot, runId);
    await mkdir(runDirectory, { recursive: true, mode: 0o700 });
    const previous = this.writeChains.get(runId) ?? Promise.resolve();
    const next = previous.then(() => appendFile(
      path.join(runDirectory, "events.jsonl"),
      `${JSON.stringify(event)}\n`,
      { mode: 0o600 }
    ));
    this.writeChains.set(runId, next.catch(() => {}));
    await next;
  }

  async readEvents(runId) {
    try {
      const content = await readFile(path.join(this.runsRoot, runId, "events.jsonl"), "utf8");
      return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async #writeRecord(record) {
    const runDirectory = path.join(this.runsRoot, record.runId);
    await mkdir(runDirectory, { recursive: true, mode: 0o700 });
    const target = path.join(runDirectory, "run.json");
    const temporary = path.join(runDirectory, `run-${process.pid}-${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, target);
  }
}
