import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const pluginRoot = path.join(repoRoot, "plugins", "creator-content-studio");
const skillsRoot = path.join(pluginRoot, "skills");
const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
const marketplacePath = path.join(repoRoot, ".agents", "plugins", "marketplace.json");
const expectedSkills = [
  "create-creator-content",
  "produce-creator-visuals",
  "plan-creator-video",
];
const expectedReferences = {
  "create-creator-content": [
    "interaction-modes.md",
    "content-quality.md",
    "publishing-platforms.md",
    "capability-fallbacks.md",
  ],
  "produce-creator-visuals": [
    "visual-inputs-and-modes.md",
    "html-production.md",
    "cover-production.md",
    "capability-fallbacks.md",
  ],
  "plan-creator-video": [
    "video-inputs-and-modes.md",
    "scene-plan-contract.md",
    "capability-fallbacks.md",
  ],
};
const publicPluginForbiddenPatterns = [
  [/CW-SKILL-1\.0/u, "internal skill evidence"],
  [/content-workstation-creator/u, "legacy repository skill name"],
  [/\.agents\/skills/u, "repository skill path"],
  [/\/Users\//u, "local absolute path"],
  [/sk-[A-Za-z0-9_-]{12,}/u, "possible API key"],
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function assertFile(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} does not exist: ${path.relative(repoRoot, filePath)}`);
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath)));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function validateSkills() {
  for (const skillName of expectedSkills) {
    const skillRoot = path.join(skillsRoot, skillName);
    const skillFile = path.join(skillRoot, "SKILL.md");
    const metadataFile = path.join(skillRoot, "agents", "openai.yaml");
    await assertFile(skillFile, `${skillName} SKILL.md`);
    await assertFile(metadataFile, `${skillName} agents/openai.yaml`);

    const skillText = await readFile(skillFile, "utf8");
    const metadataText = await readFile(metadataFile, "utf8");
    if (!skillText.startsWith("---\n")) throw new Error(`${skillName} has no YAML frontmatter`);
    if (!skillText.includes(`name: ${skillName}`)) throw new Error(`${skillName} frontmatter name mismatch`);
    if (!metadataText.includes(`$${skillName}`)) throw new Error(`${skillName} default prompt must mention the skill`);

    for (const referenceName of expectedReferences[skillName]) {
      const referencePath = path.join(skillRoot, "references", referenceName);
      await assertFile(referencePath, `${skillName} reference ${referenceName}`);
      if (!skillText.includes(`references/${referenceName}`)) {
        throw new Error(`${skillName} does not route to references/${referenceName}`);
      }
    }
  }

  const textFiles = (await listFiles(pluginRoot)).filter((file) => /\.(?:md|json|yaml|yml|svg)$/u.test(file));
  for (const filePath of textFiles) {
    const text = await readFile(filePath, "utf8");
    if (/\[TODO:|\bTODO\b/u.test(text)) {
      throw new Error(`Unresolved TODO found in ${path.relative(repoRoot, filePath)}`);
    }
    for (const [pattern, label] of publicPluginForbiddenPatterns) {
      if (pattern.test(text)) {
        throw new Error(`${label} found in ${path.relative(repoRoot, filePath)}`);
      }
    }
  }
}

async function validatePlugin() {
  const manifest = await readJson(manifestPath);
  if (manifest.name !== "creator-content-studio") throw new Error("Plugin name mismatch");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(manifest.version)) {
    throw new Error("Plugin version must use semantic versioning");
  }
  if (manifest.skills !== "./skills/") throw new Error("Plugin skills path must be ./skills/");
  if (manifest.mcpServers || manifest.apps) throw new Error("V1 must remain a Skills-only plugin");
  const defaultPrompts = manifest.interface?.defaultPrompt;
  if (!Array.isArray(defaultPrompts) || defaultPrompts.length < 1 || defaultPrompts.length > 3) {
    throw new Error("Plugin must provide between one and three starter prompts");
  }
  if (defaultPrompts.some((prompt) => typeof prompt !== "string" || prompt.length > 128)) {
    throw new Error("Every plugin starter prompt must be a string no longer than 128 characters");
  }

  for (const field of ["composerIcon", "logo", "logoDark"]) {
    const relativePath = manifest.interface?.[field];
    if (!relativePath?.startsWith("./")) throw new Error(`interface.${field} must be a relative plugin path`);
    const assetPath = path.resolve(pluginRoot, relativePath);
    if (!assetPath.startsWith(`${pluginRoot}${path.sep}`)) throw new Error(`interface.${field} escapes the plugin root`);
    await assertFile(assetPath, `interface.${field}`);
  }

  for (const field of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    const value = manifest.interface?.[field];
    if (typeof value !== "string" || !value.startsWith("https://")) {
      throw new Error(`interface.${field} must be an absolute HTTPS URL`);
    }
  }

  const screenshots = manifest.interface?.screenshots;
  if (!Array.isArray(screenshots) || screenshots.length !== 3) {
    throw new Error("Plugin must provide exactly three marketplace screenshots");
  }
  for (const relativePath of screenshots) {
    if (!/^\.\/assets\/.+\.png$/u.test(relativePath)) throw new Error("Every marketplace screenshot must be a PNG under ./assets/");
    const assetPath = path.resolve(pluginRoot, relativePath);
    if (!assetPath.startsWith(`${pluginRoot}${path.sep}`)) throw new Error("Marketplace screenshot escapes the plugin root");
    await assertFile(assetPath, "marketplace screenshot");
  }

  const marketplace = await readJson(marketplacePath);
  const entry = marketplace.plugins?.find((candidate) => candidate.name === manifest.name);
  if (!entry) throw new Error("Plugin is missing from the repository marketplace");
  if (entry.policy?.installation !== "AVAILABLE") throw new Error("Marketplace installation policy must be AVAILABLE");
  if (entry.policy?.authentication !== "ON_INSTALL") throw new Error("Marketplace authentication policy must be ON_INSTALL");
  const sourcePath = path.resolve(repoRoot, entry.source?.path ?? "");
  if (sourcePath !== pluginRoot) throw new Error("Marketplace source path does not resolve to the plugin root");
}

await validateSkills();
if (!process.argv.includes("--skills-only")) await validatePlugin();
console.log(process.argv.includes("--skills-only") ? "Plugin skills validation passed." : "Content plugin validation passed.");
