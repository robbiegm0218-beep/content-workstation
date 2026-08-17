import { execFile } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { resolveTaskSkill } from "./task-definition.mjs";

const execFileAsync = promisify(execFile);

const TASK_SCHEMAS = Object.freeze({
  research: ["topic-research.schema.json"],
  angles: ["topic-angles.schema.json"],
  content: ["content-result.schema.json"],
  html: ["artifact-manifest.schema.json"],
  cover: ["artifact-manifest.schema.json"],
  publishing: ["artifact-manifest.schema.json"],
  "video-plan": ["video-scene-plan.schema.json"]
});

export class WorkspaceManager {
  constructor(config, options = {}) {
    this.config = config;
    this.assetStore = options.assetStore ?? null;
  }

  async initialize() {
    await mkdir(this.config.workRoot, { recursive: true, mode: 0o700 });
  }

  resolveWorkspace(runId) {
    if (!/^run-[a-f0-9-]+$/.test(runId)) throw new Error("Invalid run id");
    const workspace = path.resolve(this.config.workRoot, runId);
    const root = path.resolve(this.config.workRoot);
    if (!workspace.startsWith(`${root}${path.sep}`)) throw new Error("Workspace escaped work root");
    return workspace;
  }

  async create(runId, input) {
    const workspace = this.resolveWorkspace(runId);
    await mkdir(workspace, { recursive: false, mode: 0o700 });
    await mkdir(path.join(workspace, "input"), { recursive: true });
    await mkdir(path.join(workspace, "output"), { recursive: true });
    await mkdir(path.join(workspace, "schemas"), { recursive: true });
    await mkdir(path.join(workspace, ".runner"), { recursive: true });

    if (input.taskType !== "video-render") {
      const skillName = resolveTaskSkill(input.taskType);
      await mkdir(path.join(workspace, ".agents/skills"), { recursive: true });
      await cp(
        path.join(this.config.projectRoot, "plugins/creator-content-studio/skills", skillName),
        path.join(workspace, ".agents/skills", skillName),
        { recursive: true, errorOnExist: true }
      );
      for (const schemaName of TASK_SCHEMAS[input.taskType] ?? []) {
        await cp(
          path.join(this.config.projectRoot, "schemas", schemaName),
          path.join(workspace, "schemas", schemaName)
        );
      }
    }

    const taskSnapshot = {
      runId,
      contentId: input.contentId,
      taskType: input.taskType,
      contentVersion: input.contentVersion,
      instruction: input.instruction,
      createdAt: new Date().toISOString()
    };
    await writeFile(path.join(workspace, "input/task.json"), `${JSON.stringify(taskSnapshot, null, 2)}\n`, { mode: 0o600 });

    if (input.taskType === "research" || input.taskType === "angles" || input.taskType === "content") {
      await writeFile(
        path.join(workspace, "input/creator-context.json"),
        `${JSON.stringify(input.creatorContext, null, 2)}\n`,
        { mode: 0o600 }
      );
      await writeFile(
        path.join(workspace, "input/content-brief.json"),
        `${JSON.stringify(input.contentBrief, null, 2)}\n`,
        { mode: 0o600 }
      );
    } else if (input.taskType === "video-render") {
      if (!this.assetStore) throw new Error("Asset store is required for video rendering");
      await writeFile(path.join(workspace, "input/video-scene-plan.json"), `${JSON.stringify(input.scenePlan, null, 2)}\n`, { mode: 0o600 });
      const publicAssets = path.join(workspace, ".render-public/assets");
      const copied = [];
      for (const assetId of input.assetIds) copied.push(await this.assetStore.copyTo(input.contentId, assetId, publicAssets));
      const byId = new Map(copied.map((asset) => [asset.assetId, asset]));
      const audio = input.audioAssetId ? byId.get(input.audioAssetId) : null;
      const captions = input.captionsAssetId ? byId.get(input.captionsAssetId) : null;
      if (audio && audio.kind !== "audio") throw new Error("Selected voiceover asset is not audio");
      if (captions && captions.kind !== "captions") throw new Error("Selected captions asset is not a subtitle file");
      const assetKindMap = Object.fromEntries(copied.filter((asset) => asset.kind === "image" || asset.kind === "video").map((asset) => [asset.relativePath, asset.kind]));
      await writeFile(path.join(workspace, "input/render-config.json"), `${JSON.stringify({ audioPath: audio?.relativePath ?? "", captionsPath: captions?.relativePath ?? "", assetKindMap }, null, 2)}\n`, { mode: 0o600 });
    } else {
      await writeFile(path.join(workspace, "input/confirmed-content.md"), input.confirmedContent, { mode: 0o600 });
      await writeFile(
        path.join(workspace, "input/style-config.json"),
        `${JSON.stringify(input.styleConfig, null, 2)}\n`,
        { mode: 0o600 }
      );
      if (input.taskType === "video-plan" && input.acceptedHtml) {
        await writeFile(path.join(workspace, "input/accepted-presentation.html"), input.acceptedHtml, { mode: 0o600 });
      }
    }

    await execFileAsync("git", ["init", "--quiet"], { cwd: workspace });
    return workspace;
  }

  async readInput(record) {
    const workspace = path.resolve(record.workspace);
    const root = path.resolve(this.config.workRoot);
    if (!workspace.startsWith(`${root}${path.sep}`)) throw new Error("Workspace escaped work root");
    const task = JSON.parse(await readFile(path.join(workspace, "input/task.json"), "utf8"));
    const base = {
      contentId: record.contentId,
      taskType: record.taskType,
      contentVersion: record.contentVersion,
      instruction: task.instruction ?? "",
      creatorContext: null,
      contentBrief: null,
      confirmedContent: null,
      styleConfig: null,
      acceptedHtml: null,
      scenePlan: null,
      assetIds: [],
      audioAssetId: "",
      captionsAssetId: ""
    };
    if (record.taskType === "research" || record.taskType === "angles" || record.taskType === "content") {
      base.creatorContext = JSON.parse(await readFile(path.join(workspace, "input/creator-context.json"), "utf8"));
      base.contentBrief = JSON.parse(await readFile(path.join(workspace, "input/content-brief.json"), "utf8"));
    } else if (record.taskType === "video-render") {
      base.scenePlan = JSON.parse(await readFile(path.join(workspace, "input/video-scene-plan.json"), "utf8"));
      const config = JSON.parse(await readFile(path.join(workspace, "input/render-config.json"), "utf8"));
      const assets = await this.assetStore.list(record.contentId);
      base.assetIds = assets.filter((asset) => base.scenePlan.materials.includes(asset.relativePath) || asset.relativePath === config.audioPath || asset.relativePath === config.captionsPath).map((asset) => asset.assetId);
      base.audioAssetId = assets.find((asset) => asset.relativePath === config.audioPath)?.assetId ?? "";
      base.captionsAssetId = assets.find((asset) => asset.relativePath === config.captionsPath)?.assetId ?? "";
    } else {
      base.confirmedContent = await readFile(path.join(workspace, "input/confirmed-content.md"), "utf8");
      base.styleConfig = JSON.parse(await readFile(path.join(workspace, "input/style-config.json"), "utf8"));
      if (record.taskType === "video-plan" && base.styleConfig.sourceMode === "accepted-html") {
        base.acceptedHtml = await readFile(path.join(workspace, "input/accepted-presentation.html"), "utf8");
      }
    }
    return base;
  }
}
