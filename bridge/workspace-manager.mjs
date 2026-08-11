import { execFile } from "node:child_process";
import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class WorkspaceManager {
  constructor(config) {
    this.config = config;
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

    await cp(
      path.join(this.config.projectRoot, ".agents/skills/content-workstation-creator"),
      path.join(workspace, ".agents/skills/content-workstation-creator"),
      { recursive: true, errorOnExist: true }
    );
    await cp(
      path.join(this.config.projectRoot, "schemas/content-result.schema.json"),
      path.join(workspace, "schemas/content-result.schema.json")
    );
    await cp(
      path.join(this.config.projectRoot, "schemas/topic-angles.schema.json"),
      path.join(workspace, "schemas/topic-angles.schema.json")
    );
    await cp(
      path.join(this.config.projectRoot, "schemas/artifact-manifest.schema.json"),
      path.join(workspace, "schemas/artifact-manifest.schema.json")
    );

    const taskSnapshot = {
      runId,
      contentId: input.contentId,
      taskType: input.taskType,
      contentVersion: input.contentVersion,
      instruction: input.instruction,
      createdAt: new Date().toISOString()
    };
    await writeFile(path.join(workspace, "input/task.json"), `${JSON.stringify(taskSnapshot, null, 2)}\n`, { mode: 0o600 });

    if (input.taskType === "angles" || input.taskType === "content") {
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
    } else {
      await writeFile(path.join(workspace, "input/confirmed-content.md"), input.confirmedContent, { mode: 0o600 });
      await writeFile(
        path.join(workspace, "input/style-config.json"),
        `${JSON.stringify(input.styleConfig, null, 2)}\n`,
        { mode: 0o600 }
      );
    }

    await execFileAsync("git", ["init", "--quiet"], { cwd: workspace });
    return workspace;
  }
}
