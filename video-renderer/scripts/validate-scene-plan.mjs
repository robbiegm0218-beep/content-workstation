import {readFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('Usage: node scripts/validate-scene-plan.mjs <scene-plan.json>');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(await readFile(path.resolve(projectRoot, '../schemas/video-scene-plan.schema.json'), 'utf8'));
const data = JSON.parse(await readFile(path.resolve(projectRoot, inputPath), 'utf8'));
const validate = new Ajv2020({allErrors: true}).compile(schema);

if (!validate(data)) {
  console.error(validate.errors);
  process.exit(1);
}

const expectedDimensions = data.aspectRatio === '9:16' ? {width: 1080, height: 1920} : {width: 1920, height: 1080};
if (data.width !== expectedDimensions.width || data.height !== expectedDimensions.height) {
  throw new Error(`Aspect ratio ${data.aspectRatio} must use ${expectedDimensions.width}x${expectedDimensions.height}`);
}
if (![900, 9000, 14400].includes(data.durationInFrames)) throw new Error('Unsupported video duration');

let expectedStart = 0;
const sceneIds = new Set();
const materialSet = new Set(data.materials);
for (const scene of data.scenes) {
  if (sceneIds.has(scene.id)) throw new Error(`Scene id must be unique: ${scene.id}`);
  sceneIds.add(scene.id);
  if (scene.startFrame !== expectedStart) throw new Error(`Scene ${scene.id} must start at frame ${expectedStart}`);
  for (const materialId of scene.materialIds) {
    if (!materialSet.has(materialId)) throw new Error(`Scene ${scene.id} references undeclared material: ${materialId}`);
  }
  expectedStart += scene.durationInFrames;
}
if (expectedStart !== data.durationInFrames) throw new Error('Scene durations must fill the whole composition');
if (data.sourceMode === 'direct-content' && (data.sourceTrace.htmlRunId || data.sourceTrace.htmlSha256 || data.sourceTrace.htmlSections.length)) {
  throw new Error('Direct-content plans must keep the HTML source trace empty');
}
if (data.sourceMode === 'accepted-html' && (!data.sourceTrace.htmlRunId || !data.sourceTrace.htmlSha256 || data.sourceTrace.htmlSections.length === 0)) {
  throw new Error('Accepted-HTML plans must include a complete source trace');
}
console.log(`Scene plan valid: ${data.scenes.length} scenes, ${data.durationInFrames / data.fps}s, ${data.width}x${data.height}`);
