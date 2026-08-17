import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, rmdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { MINIMUM_VALIDATED_CODEX_VERSION } from "./config.mjs";

const execFileAsync = promisify(execFile);

function versionNumbers(value) {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersion(left, right) {
  const a = versionNumbers(left);
  const b = versionNumbers(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

async function commandResult(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, { timeout: 15_000, ...options });
    return { ok: true, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.trim?.() ?? "",
      stderr: error.stderr?.trim?.() ?? error.message,
      code: error.code
    };
  }
}

async function canListen(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => resolve({ available: false, errorCode: error.code }));
    server.listen(port, host, () => server.close(() => resolve({ available: true, errorCode: null })));
  });
}

async function findExecutable(root, acceptedNames) {
  const queue = [root];
  while (queue.length) {
    const directory = queue.shift();
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      if (entry.isFile() && acceptedNames.has(entry.name)) {
        try {
          await access(fullPath, fsConstants.X_OK);
          return fullPath;
        } catch {}
      }
    }
  }
  return null;
}

export async function probeRemotionEnvironment(config) {
  const packageNames = ["remotion", "@remotion/player", "@remotion/cli", "@remotion/renderer", "@remotion/transitions"];
  const packages = {};
  for (const packageName of packageNames) {
    const relative = `${packageName}/package.json`;
    const candidates = [
      path.join(config.projectRoot, "node_modules", relative),
      path.join(config.projectRoot, "video-renderer/node_modules", relative)
    ];
    for (const candidate of candidates) {
      try {
        packages[packageName] = JSON.parse(await readFile(candidate, "utf8")).version;
        break;
      } catch {}
    }
  }
  const versions = Object.values(packages);
  const browserPath = await findExecutable(
    path.join(config.projectRoot, "node_modules/.remotion"),
    new Set(["chrome-headless-shell", "Google Chrome for Testing"])
  ) ?? await findExecutable(
    path.join(config.projectRoot, "video-renderer/node_modules/.remotion"),
    new Set(["chrome-headless-shell", "Google Chrome for Testing"])
  );
  return {
    packages,
    packagesInstalled: packageNames.every((name) => Boolean(packages[name])),
    aligned: versions.length === packageNames.length && new Set(versions).size === 1,
    version: versions.length && new Set(versions).size === 1 ? versions[0] : null,
    browserAvailable: Boolean(browserPath),
    browserPath
  };
}

export async function runDoctor(config, {
  bridgeIsListening = false,
  webIsListening = false,
  commandRunner = commandResult,
  portProbe = canListen,
  remotionProbe = probeRemotionEnvironment
} = {}) {
  const checks = [];
  const add = (id, status, message, fix = null, details = null) => {
    checks.push({ id, status, message, fix, details });
  };

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  add(
    "node",
    nodeMajor >= 22 ? "pass" : "fail",
    `Node.js ${process.versions.node}`,
    nodeMajor >= 22 ? null : "Install Node.js 22.13 or newer"
  );

  const codexVersion = await commandRunner("codex", ["--version"]);
  if (!codexVersion.ok) {
    add("codex", "fail", "Codex CLI is not available", "Install Codex CLI and make sure codex is on PATH", codexVersion.stderr);
  } else {
    const comparison = compareVersion(codexVersion.stdout, MINIMUM_VALIDATED_CODEX_VERSION);
    const exactValidatedVersion = codexVersion.stdout.includes(MINIMUM_VALIDATED_CODEX_VERSION);
    const versionStatus = comparison === null
      ? "unparseable"
      : comparison < 0
        ? "older"
        : exactValidatedVersion
          ? "validated"
          : comparison > 0
            ? "newer-untested"
            : "same-base-untested";
    add(
      "codex",
      comparison === null || comparison < 0 ? "fail" : exactValidatedVersion ? "pass" : "warn",
      codexVersion.stdout,
      comparison !== null && comparison < 0 ? `Use the validated version ${MINIMUM_VALIDATED_CODEX_VERSION} or newer` : null,
      { minimumValidatedVersion: MINIMUM_VALIDATED_CODEX_VERSION, versionStatus }
    );
  }

  const login = codexVersion.ok ? await commandRunner("codex", ["login", "status"]) : { ok: false, stderr: "Codex unavailable" };
  const loginMessage = login.stdout || login.stderr.split(/\r?\n/).filter(Boolean).at(-1) || "Codex login status is available";
  add("login", login.ok ? "pass" : "fail", login.ok ? loginMessage : "Codex is not logged in", login.ok ? null : "Run: codex login", login.ok ? null : login.stderr || null);

  const pluginPath = path.join(config.projectRoot, "plugins/creator-content-studio");
  const requiredPluginFiles = [
    ".codex-plugin/plugin.json",
    "skills/create-creator-content/SKILL.md",
    "skills/produce-creator-visuals/SKILL.md",
    "skills/plan-creator-video/SKILL.md"
  ];
  try {
    await Promise.all(requiredPluginFiles.map((relativePath) => access(path.join(pluginPath, relativePath))));
    add("skill", "pass", "Creator Content Studio plugin source is available", null, pluginPath);
  } catch {
    add("skill", "fail", "Creator Content Studio plugin source is incomplete", "Restore plugins/creator-content-studio from Git");
  }

  const pluginList = codexVersion.ok ? await commandRunner("codex", ["plugin", "list", "--json"]) : { ok: false, stderr: "Codex unavailable" };
  let installedPlugin = null;
  if (pluginList.ok) {
    try {
      const parsed = JSON.parse(pluginList.stdout);
      installedPlugin = parsed.installed?.find((plugin) => plugin.name === "creator-content-studio") ?? null;
    } catch {}
  }
  add(
    "plugin-installation",
    installedPlugin?.installed && installedPlugin?.enabled ? "pass" : "warn",
    installedPlugin?.installed && installedPlugin?.enabled
      ? `Creator Content Studio ${installedPlugin.version || ""} is installed and enabled`.trim()
      : "Creator Content Studio is not installed in Codex; Workstation can still use the bundled Skills",
    installedPlugin?.installed && installedPlugin?.enabled ? null : "From the repository root, run: codex plugin marketplace add . && codex plugin add creator-content-studio@personal",
    installedPlugin ? { pluginId: installedPlugin.pluginId, version: installedPlugin.version, enabled: installedPlugin.enabled } : null
  );

  const probeDirectory = path.join(config.workRoot, `.doctor-${randomUUID()}`);
  try {
    await mkdir(config.workRoot, { recursive: true, mode: 0o700 });
    await mkdir(probeDirectory, { recursive: false, mode: 0o700 });
    await rmdir(probeDirectory);
    add("workspace", "pass", "Isolated work directory is writable");
  } catch (error) {
    add("workspace", "fail", "Cannot create an isolated work directory", "Check project directory permissions", error.message);
  }

  const features = codexVersion.ok ? await commandRunner("codex", ["features", "list"]) : { ok: false, stdout: "" };
  const imageEnabled = features.ok && /^image_generation\s+\S+\s+true$/m.test(features.stdout);
  add(
    "image-generation",
    imageEnabled ? "pass" : "warn",
    imageEnabled ? "Codex image generation is enabled" : "Image generation is unavailable; template rendering will be used",
    imageEnabled ? null : "Check Codex plan, workspace settings, and image_generation feature"
  );

  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  let chromeAvailable = false;
  try {
    await access(chromePath);
    chromeAvailable = true;
  } catch {}
  const sips = await commandRunner("/usr/bin/sips", ["--version"]);
  add(
    "renderer",
    chromeAvailable || sips.ok ? "pass" : "fail",
    chromeAvailable ? "Google Chrome renderer is available" : sips.ok ? "sips renderer is available" : "No supported local renderer found",
    chromeAvailable || sips.ok ? null : "Install Google Chrome or configure a supported renderer"
  );

  const remotion = await remotionProbe(config);
  const remotionReady = remotion.packagesInstalled && remotion.aligned;
  add(
    "remotion",
    remotionReady ? "pass" : "warn",
    remotionReady
      ? `Remotion ${remotion.version} packages are installed and aligned`
      : remotion.packagesInstalled
        ? "Remotion package versions are not aligned"
        : "Remotion video packages are not fully installed",
    remotionReady ? null : "Run: npm run video:install",
    { version: remotion.version, packages: remotion.packages }
  );
  add(
    "remotion-browser",
    remotion.browserAvailable ? "pass" : "warn",
    remotion.browserAvailable ? "Remotion Headless Chrome is ready" : "Remotion Headless Chrome has not been prepared",
    remotion.browserAvailable ? null : "Run: npm run video:browser",
    remotion.browserAvailable ? { available: true } : { available: false }
  );

  const [ffmpeg, ffprobe] = await Promise.all([
    commandRunner("ffmpeg", ["-version"]),
    commandRunner("ffprobe", ["-version"])
  ]);
  const mediaToolsReady = ffmpeg.ok && ffprobe.ok;
  add(
    "video-tools",
    mediaToolsReady ? "pass" : "warn",
    mediaToolsReady
      ? `${ffmpeg.stdout.split(/\r?\n/)[0]}; ${ffprobe.stdout.split(/\r?\n/)[0]}`
      : "FFmpeg or FFprobe is unavailable; dynamic video cannot be merged and verified",
    mediaToolsReady ? null : "Install FFmpeg, then run npm run doctor again",
    { ffmpeg: ffmpeg.ok, ffprobe: ffprobe.ok }
  );

  const webPort = webIsListening ? { available: true, errorCode: null } : await portProbe("127.0.0.1", 3000);
  add(
    "web-port",
    webPort.available ? "pass" : "warn",
    webIsListening
      ? "Web app is running on port 3000"
      : webPort.available
        ? "Port 3000 is available"
        : webPort.errorCode === "EADDRINUSE"
          ? "Port 3000 is already in use"
          : `Port 3000 probe was blocked (${webPort.errorCode})`
  );
  const bridgePort = bridgeIsListening ? { available: true, errorCode: null } : await portProbe(config.host, config.port);
  const bridgePortStatus = bridgePort.available ? "pass" : bridgePort.errorCode === "EADDRINUSE" ? "fail" : "warn";
  add(
    "bridge-port",
    bridgePortStatus,
    bridgeIsListening
      ? `Bridge is listening on ${config.host}:${config.port}`
      : bridgePort.available
        ? `Port ${config.port} is available`
        : bridgePort.errorCode === "EADDRINUSE"
          ? `Port ${config.port} is already in use`
          : `Port ${config.port} probe was blocked (${bridgePort.errorCode})`,
    bridgePortStatus === "fail" ? `Stop the process using port ${config.port} or configure another local port` : null
  );

  const overall = checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "warn") ? "warn" : "pass";
  return { overall, checkedAt: new Date().toISOString(), checks };
}
