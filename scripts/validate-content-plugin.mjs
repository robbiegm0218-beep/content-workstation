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
  }

  const textFiles = (await listFiles(pluginRoot)).filter((file) => /\.(?:md|json|yaml|yml|svg)$/u.test(file));
  for (const filePath of textFiles) {
    const text = await readFile(filePath, "utf8");
    if (/\[TODO:|\bTODO\b/u.test(text)) {
      throw new Error(`Unresolved TODO found in ${path.relative(repoRoot, filePath)}`);
    }
    if (/\/Users\/|sk-[A-Za-z0-9_-]{12,}/u.test(text)) {
      throw new Error(`Private path or possible key found in ${path.relative(repoRoot, filePath)}`);
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

  for (const field of ["composerIcon", "logo"]) {
    const relativePath = manifest.interface?.[field];
    if (!relativePath?.startsWith("./")) throw new Error(`interface.${field} must be a relative plugin path`);
    const assetPath = path.resolve(pluginRoot, relativePath);
    if (!assetPath.startsWith(`${pluginRoot}${path.sep}`)) throw new Error(`interface.${field} escapes the plugin root`);
    await assertFile(assetPath, `interface.${field}`);
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
