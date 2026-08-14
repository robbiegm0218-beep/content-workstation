import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {selectPosterFrame} from '../src/timing.mjs';
import {buildRenderSegments} from '../src/segments.mjs';

const workspaceArg = process.argv[2];
if (!workspaceArg) throw new Error('Usage: render-workspace.mjs <workspace>');
const workspace = path.resolve(workspaceArg);
const rendererRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(await readFile(path.join(workspace, 'input/video-scene-plan.json'), 'utf8'));
const renderConfig = JSON.parse(await readFile(path.join(workspace, 'input/render-config.json'), 'utf8'));
const emit = (event) => process.stdout.write(`CW_RENDER_EVENT ${JSON.stringify(event)}\n`);
let lastRenderProgressPercent = -1;
const emitRenderProgress = (progress) => {
  const normalized = Math.max(0, Math.min(1, progress));
  const percent = Math.floor(normalized * 100);
  if (percent === lastRenderProgressPercent) return;
  lastRenderProgressPercent = percent;
  emit({type: 'render.progress', progress: normalized});
};

function parseTimestamp(value) {
  const parts = value.replace(',', '.').split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  return Number.NaN;
}

function parseCaptions(text) {
  return text.replace(/^WEBVTT[^\n]*\n+/i, '').split(/\n\s*\n/).flatMap((block) => {
    const lines = block.trim().split(/\r?\n/).filter(Boolean);
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex < 0) return [];
    const [start, endWithSettings] = lines[timeIndex].split('-->').map((item) => item.trim());
    const startMs = parseTimestamp(start);
    const endMs = parseTimestamp(endWithSettings.split(/\s+/)[0]);
    const textValue = lines.slice(timeIndex + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && textValue ? [{startMs, endMs, text: textValue}] : [];
  }).slice(0, 500);
}

async function readCheckpoint(checkpointPath, planHash) {
  try {
    const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
    return checkpoint.planHash === planHash && Array.isArray(checkpoint.completed) ? checkpoint : {planHash, completed: []};
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {planHash, completed: []};
    throw error;
  }
}

const concatPath = (value) => value.replaceAll("'", "'\\''");

const inputProps = {...plan};
inputProps.assetKindMap = renderConfig.assetKindMap || {};
if (renderConfig.audioPath) inputProps.audioSrc = renderConfig.audioPath;
if (renderConfig.captionsPath) inputProps.captions = parseCaptions(await readFile(path.join(workspace, '.render-public', renderConfig.captionsPath), 'utf8'));

const serveUrl = await bundle({
  entryPoint: path.join(rendererRoot, 'src/index.ts'),
  publicDir: path.join(workspace, '.render-public'),
  onProgress: (progress) => emit({type: 'bundle.progress', progress}),
});
const compositionId = plan.aspectRatio === '9:16' ? 'ContentWorkstationPortrait' : 'ContentWorkstationLandscape';
const composition = await selectComposition({serveUrl, id: compositionId, inputProps});
const videoPath = path.join(workspace, 'output/video.mp4');
const posterPath = path.join(workspace, 'output/video-poster.png');
const segmentDirectory = path.join(workspace, 'output/segments');
const checkpointPath = path.join(workspace, 'output/render-checkpoint.json');
await mkdir(segmentDirectory, {recursive: true});
const segments = buildRenderSegments(plan.scenes);
const planHash = createHash('sha256').update(JSON.stringify({plan, renderConfig})).digest('hex');
const checkpoint = await readCheckpoint(checkpointPath, planHash);
let reusedSegments = 0;
for (const segment of segments) {
  const filename = `segment-${String(segment.index + 1).padStart(3, '0')}.mp4`;
  const segmentPath = path.join(segmentDirectory, filename);
  const completed = checkpoint.completed.find((item) => item.index === segment.index && item.startFrame === segment.startFrame && item.endFrame === segment.endFrame);
  let reusable = false;
  if (completed) {
    try {
      const segmentStat = await stat(segmentPath);
      reusable = segmentStat.size > 0 && segmentStat.size === completed.size;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (reusable) {
    reusedSegments += 1;
    emit({type: 'render.segment.reused', index: segment.index + 1, count: segments.length, startFrame: segment.startFrame, endFrame: segment.endFrame});
    emitRenderProgress((segment.index + 1) / segments.length);
    continue;
  }
  emit({type: 'render.segment.started', index: segment.index + 1, count: segments.length, startFrame: segment.startFrame, endFrame: segment.endFrame});
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: segmentPath,
    inputProps,
    overwrite: true,
    frameRange: [segment.startFrame, segment.endFrame - 1],
    concurrency: plan.durationInFrames > 900 ? 2 : undefined,
    onProgress: ({progress}) => emitRenderProgress((segment.index + progress) / segments.length),
  });
  const segmentStat = await stat(segmentPath);
  checkpoint.completed = checkpoint.completed.filter((item) => item.index !== segment.index);
  checkpoint.completed.push({...segment, path: `output/segments/${filename}`, size: segmentStat.size});
  checkpoint.completed.sort((a, b) => a.index - b.index);
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, {mode: 0o600});
  emit({type: 'render.segment.completed', index: segment.index + 1, count: segments.length, startFrame: segment.startFrame, endFrame: segment.endFrame});
}
const concatListPath = path.join(segmentDirectory, 'concat.txt');
await writeFile(concatListPath, `${segments.map((segment) => `file '${concatPath(path.join(segmentDirectory, `segment-${String(segment.index + 1).padStart(3, '0')}.mp4`))}'`).join('\n')}\n`, {mode: 0o600});
emit({type: 'render.merging', count: segments.length});
const merge = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', '-movflags', '+faststart', videoPath], {encoding: 'utf8'});
if (merge.status !== 0) throw new Error(`ffmpeg concat failed: ${merge.stderr.slice(-2000)}`);
await renderStill({composition, serveUrl, output: posterPath, inputProps, frame: selectPosterFrame(plan.scenes), overwrite: true});

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', videoPath], {encoding: 'utf8'});
if (probe.status !== 0) throw new Error(`ffprobe failed: ${probe.stderr}`);
const metadata = JSON.parse(probe.stdout);
const videoStream = metadata.streams.find((stream) => stream.width && stream.height);
const [videoBuffer, posterBuffer, videoStat, posterStat] = await Promise.all([readFile(videoPath), readFile(posterPath), stat(videoPath), stat(posterPath)]);
const artifact = (id, type, relativePath, mimeType, buffer, size) => ({id, type, path: relativePath, mimeType, width: Number(videoStream.width), height: Number(videoStream.height), size, sha256: createHash('sha256').update(buffer).digest('hex')});
const manifest = {
  manifestVersion: '1.0', taskType: 'video-render', generationMode: 'remotion-local-render', templateVersion: 'cw-remotion-1.0', remotionVersion: '4.0.508',
  width: Number(videoStream.width), height: Number(videoStream.height), fps: 30, durationInFrames: plan.durationInFrames, durationSeconds: Number(metadata.format.duration),
  artifacts: [artifact('video-mp4', 'video-mp4', 'output/video.mp4', 'video/mp4', videoBuffer, videoStat.size), artifact('video-poster', 'video-poster', 'output/video-poster.png', 'image/png', posterBuffer, posterStat.size)],
  notes: [renderConfig.audioPath ? '包含用户登记的旁白音频' : '未配置旁白音频', renderConfig.captionsPath ? '包含用户导入的字幕' : '未导入字幕', `按场景边界分为 ${segments.length} 段渲染`, reusedSegments ? `本次续渲复用了 ${reusedSegments} 个已完成分段` : '本次从第一段开始渲染'],
};
await writeFile(path.join(workspace, 'output/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
emit({type: 'render.completed', manifest});
