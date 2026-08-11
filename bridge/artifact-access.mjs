import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./security.mjs";

export async function openRegisteredArtifact(runRecord, fileId) {
  const artifact = runRecord.artifactManifest?.artifacts?.find((item) => item.id === fileId);
  if (!artifact) throw new HttpError(404, "ARTIFACT_NOT_FOUND", "Artifact not found");
  if (path.isAbsolute(artifact.path)) throw new HttpError(500, "UNSAFE_ARTIFACT", "Artifact path must be relative");

  const outputRoot = path.resolve(runRecord.workspace, "output");
  const artifactPath = path.resolve(runRecord.workspace, ...artifact.path.replaceAll("\\", "/").split("/"));
  if (!artifactPath.startsWith(`${outputRoot}${path.sep}`)) {
    throw new HttpError(500, "UNSAFE_ARTIFACT", "Artifact path escaped output directory");
  }

  let stat;
  try {
    stat = await lstat(artifactPath);
  } catch (error) {
    if (error.code === "ENOENT") throw new HttpError(404, "ARTIFACT_MISSING", "Artifact file is missing");
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new HttpError(500, "UNSAFE_ARTIFACT", "Artifact must be a regular file");
  }
  const [resolvedRoot, resolvedArtifact] = await Promise.all([realpath(outputRoot), realpath(artifactPath)]);
  if (!resolvedArtifact.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new HttpError(500, "UNSAFE_ARTIFACT", "Artifact real path escaped output directory");
  }

  return {
    artifact,
    size: stat.size,
    stream: createReadStream(resolvedArtifact)
  };
}
