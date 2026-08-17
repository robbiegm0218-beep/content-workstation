import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBridgeConfig } from "../../bridge/config.mjs";
import { runDoctor } from "../../bridge/doctor.mjs";

function checkById(report, id) {
  return report.checks.find((check) => check.id === id);
}

test("Doctor reports missing Codex, login, Skill and image capability", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-doctor-"));
  const config = createBridgeConfig({
    projectRoot: root,
    dataRoot: path.join(root, ".data"),
    workRoot: path.join(root, "work"),
    port: 4317
  });
  const commandRunner = async (command) => command === "/usr/bin/sips"
    ? { ok: false, stdout: "", stderr: "missing" }
    : { ok: false, stdout: "", stderr: "command not found" };
  const report = await runDoctor(config, {
    commandRunner,
    portProbe: async () => ({ available: true, errorCode: null })
  });

  assert.equal(report.overall, "fail");
  assert.equal(checkById(report, "codex").status, "fail");
  assert.equal(checkById(report, "login").status, "fail");
  assert.equal(checkById(report, "skill").status, "fail");
  assert.equal(checkById(report, "image-generation").status, "warn");
  assert.equal(checkById(report, "remotion").status, "warn");
  assert.equal(checkById(report, "remotion-browser").status, "warn");
  assert.equal(checkById(report, "video-tools").status, "warn");
});

test("Doctor rejects a Codex version older than the validated baseline", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-doctor-"));
  const config = createBridgeConfig({
    projectRoot: root,
    dataRoot: path.join(root, ".data"),
    workRoot: path.join(root, "work"),
    port: 4317
  });
  const commandRunner = async (command, args) => {
    if (command === "codex" && args[0] === "--version") {
      return { ok: true, stdout: "codex-cli 0.100.0", stderr: "" };
    }
    if (command === "codex" && args[0] === "login") {
      return { ok: true, stdout: "Logged in using ChatGPT", stderr: "" };
    }
    if (command === "codex" && args[0] === "features") {
      return { ok: true, stdout: "image_generation stable false", stderr: "" };
    }
    return { ok: true, stdout: "sips-1", stderr: "" };
  };
  const report = await runDoctor(config, {
    commandRunner,
    portProbe: async () => ({ available: true, errorCode: null })
  });

  assert.equal(checkById(report, "codex").status, "fail");
  assert.equal(checkById(report, "codex").details.versionStatus, "older");
  assert.equal(checkById(report, "image-generation").status, "warn");
});

test("Doctor reports a complete Remotion rendering environment", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-doctor-"));
  const config = createBridgeConfig({
    projectRoot: root,
    dataRoot: path.join(root, ".data"),
    workRoot: path.join(root, "work"),
    port: 4317
  });
  const commandRunner = async (command, args) => {
    if (command === "codex" && args[0] === "--version") return { ok: true, stdout: "codex-cli 0.114.0", stderr: "" };
    if (command === "codex" && args[0] === "login") return { ok: true, stdout: "Logged in using ChatGPT", stderr: "" };
    if (command === "codex" && args[0] === "features") return { ok: true, stdout: "image_generation stable true", stderr: "" };
    if (command === "ffmpeg") return { ok: true, stdout: "ffmpeg version 8.0", stderr: "" };
    if (command === "ffprobe") return { ok: true, stdout: "ffprobe version 8.0", stderr: "" };
    return { ok: true, stdout: "sips-1", stderr: "" };
  };
  const remotionProbe = async () => ({
    packages: { remotion: "4.0.508", "@remotion/player": "4.0.508", "@remotion/cli": "4.0.508", "@remotion/renderer": "4.0.508", "@remotion/transitions": "4.0.508" },
    packagesInstalled: true,
    aligned: true,
    version: "4.0.508",
    browserAvailable: true,
    browserPath: "/private/test/chrome-headless-shell"
  });
  const report = await runDoctor(config, {
    commandRunner,
    remotionProbe,
    portProbe: async () => ({ available: true, errorCode: null })
  });

  assert.equal(checkById(report, "remotion").status, "pass");
  assert.equal(checkById(report, "remotion-browser").status, "pass");
  assert.equal(checkById(report, "video-tools").status, "pass");
  assert.match(checkById(report, "video-tools").message, /ffmpeg version 8\.0/);
});

test("Doctor reports the bundled plugin source and Codex installation state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "content-workstation-doctor-plugin-"));
  for (const relativePath of [
    ".codex-plugin/plugin.json",
    "skills/create-creator-content/SKILL.md",
    "skills/produce-creator-visuals/SKILL.md",
    "skills/plan-creator-video/SKILL.md"
  ]) {
    const target = path.join(root, "plugins/creator-content-studio", relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "test");
  }
  const config = createBridgeConfig({ projectRoot: root, dataRoot: path.join(root, ".data"), workRoot: path.join(root, "work"), port: 4317 });
  const commandRunner = async (command, args) => {
    if (command === "codex" && args[0] === "--version") return { ok: true, stdout: "codex-cli 0.200.0", stderr: "" };
    if (command === "codex" && args[0] === "login") return { ok: true, stdout: "Logged in using ChatGPT", stderr: "" };
    if (command === "codex" && args[0] === "plugin") return { ok: true, stdout: JSON.stringify({ installed: [{ pluginId: "creator-content-studio@personal", name: "creator-content-studio", version: "0.1.0", installed: true, enabled: true }] }), stderr: "" };
    if (command === "codex" && args[0] === "features") return { ok: true, stdout: "image_generation stable false", stderr: "" };
    return { ok: false, stdout: "", stderr: "missing" };
  };
  const report = await runDoctor(config, { commandRunner, portProbe: async () => ({ available: true, errorCode: null }) });

  assert.equal(checkById(report, "skill").status, "pass");
  assert.equal(checkById(report, "plugin-installation").status, "pass");
  assert.equal(checkById(report, "plugin-installation").details.pluginId, "creator-content-studio@personal");
});
