import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./security.mjs";

function assertPlainObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_WORKSTATION_STATE", `${field} must be an object`);
  }
}

export function validateWorkstationState(input) {
  assertPlainObject(input, "workstation state");
  if (input.version !== "1.0") {
    throw new HttpError(400, "INVALID_WORKSTATION_STATE", "workstation state version must be 1.0");
  }
  assertPlainObject(input.database, "database");
  if (!Array.isArray(input.database.contents) || input.database.contents.length > 5_000) {
    throw new HttpError(400, "INVALID_WORKSTATION_STATE", "database.contents must be an array with at most 5000 items");
  }
  if (!Array.isArray(input.database.cases) || input.database.cases.length > 5_000) {
    throw new HttpError(400, "INVALID_WORKSTATION_STATE", "database.cases must be an array with at most 5000 items");
  }
  assertPlainObject(input.database.settings, "database.settings");
  return {
    version: "1.0",
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
    database: structuredClone(input.database),
  };
}

export class WorkstationStateStore {
  constructor(config) {
    this.statePath = path.join(config.dataRoot, "workstation-state.json");
  }

  async read() {
    try {
      return validateWorkstationState(JSON.parse(await readFile(this.statePath, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async write(input) {
    const state = validateWorkstationState({ ...input, updatedAt: new Date().toISOString() });
    await mkdir(path.dirname(this.statePath), { recursive: true, mode: 0o700 });
    const temporary = path.join(path.dirname(this.statePath), `workstation-state-${process.pid}-${Date.now()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.statePath);
    return state;
  }
}
