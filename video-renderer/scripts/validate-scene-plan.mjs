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

let expectedStart = 0;
for (const scene of data.scenes) {
  if (scene.startFrame !== expectedStart) throw new Error(`Scene ${scene.id} must start at frame ${expectedStart}`);
  expectedStart += scene.durationInFrames;
}
if (expectedStart !== data.durationInFrames) throw new Error('Scene durations must fill the whole composition');
console.log(`Scene plan valid: ${data.scenes.length} scenes, ${data.durationInFrames / data.fps}s, ${data.width}x${data.height}`);
