import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, 'scripts/validate-scene-plan.mjs');
const samplePath = path.join(root, 'fixtures/sample-scene-plan.json');

function run(inputPath) {
  return spawnSync(process.execPath, [validator, inputPath], {cwd: root, encoding: 'utf8'});
}

test('accepts the fixed 30 second sample plan', () => {
  const result = run(samplePath);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /6 scenes, 30s, 1920x1080/);
});

test('accepts an independent 9:16 portrait contract', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cw-video-portrait-'));
  const portrait = JSON.parse(await readFile(samplePath, 'utf8'));
  portrait.aspectRatio = '9:16';
  portrait.width = 1080;
  portrait.height = 1920;
  const portraitPath = path.join(directory, 'portrait.json');
  await writeFile(portraitPath, JSON.stringify(portrait));
  const result = run(portraitPath);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1080x1920/);
});

test('rejects unknown fields, excessive duration, and unsafe material paths', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cw-video-plan-'));
  const sample = JSON.parse(await readFile(samplePath, 'utf8'));

  const unknown = structuredClone(sample);
  unknown.unexpected = true;
  const unknownPath = path.join(directory, 'unknown.json');
  await writeFile(unknownPath, JSON.stringify(unknown));
  assert.notEqual(run(unknownPath).status, 0);

  const duration = structuredClone(sample);
  duration.scenes[0].durationInFrames = 301;
  const durationPath = path.join(directory, 'duration.json');
  await writeFile(durationPath, JSON.stringify(duration));
  assert.notEqual(run(durationPath).status, 0);

  const unsafe = structuredClone(sample);
  unsafe.materials = ['../private.mp4'];
  const unsafePath = path.join(directory, 'unsafe.json');
  await writeFile(unsafePath, JSON.stringify(unsafe));
  assert.notEqual(run(unsafePath).status, 0);
});

test('rejects undeclared material references and incomplete HTML traceability', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cw-video-trace-'));
  const sample = JSON.parse(await readFile(samplePath, 'utf8'));

  const undeclared = structuredClone(sample);
  undeclared.scenes[0].materialIds = ['assets/missing.png'];
  const undeclaredPath = path.join(directory, 'undeclared.json');
  await writeFile(undeclaredPath, JSON.stringify(undeclared));
  assert.notEqual(run(undeclaredPath).status, 0);

  const htmlPlan = structuredClone(sample);
  htmlPlan.sourceMode = 'accepted-html';
  const htmlPlanPath = path.join(directory, 'html-plan.json');
  await writeFile(htmlPlanPath, JSON.stringify(htmlPlan));
  assert.notEqual(run(htmlPlanPath).status, 0);
});
