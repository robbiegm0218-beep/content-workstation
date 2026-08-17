import { writeFile } from "node:fs/promises";

export const BRIDGE_SKILL_EVIDENCE = "CW-BRIDGE-1.0";

export function attachStructuredSkillEvidence(result, skillName) {
  return {
    ...result,
    generationMeta: {
      ...(result.generationMeta ?? {}),
      skillName,
      skillEvidence: BRIDGE_SKILL_EVIDENCE
    }
  };
}

export function attachManifestSkillEvidence(manifest) {
  return {
    ...manifest,
    skillEvidence: BRIDGE_SKILL_EVIDENCE
  };
}

export async function persistJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}
