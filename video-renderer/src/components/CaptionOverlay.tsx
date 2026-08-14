import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {CaptionCue, Scene} from '../types';

const splitNarration = (text: string) => text.trim().split(/(?<=[。！？；])/).map((item) => item.trim()).filter(Boolean);

export const buildSceneCaptionCues = (scenes: Scene[], fps: number): CaptionCue[] => scenes.flatMap((scene) => {
  if (!scene.showCaptions || !scene.narration.trim()) return [];
  const parts = splitNarration(scene.narration);
  if (!parts.length) return [];
  const sceneStartMs = scene.startFrame / fps * 1000;
  const sceneDurationMs = scene.durationInFrames / fps * 1000;
  const totalWeight = parts.reduce((sum, part) => sum + Math.max(1, part.length), 0);
  let elapsedMs = 0;
  return parts.map((text, index) => {
    const startMs = sceneStartMs + elapsedMs;
    const durationMs = index === parts.length - 1 ? sceneDurationMs - elapsedMs : sceneDurationMs * Math.max(1, text.length) / totalWeight;
    elapsedMs += durationMs;
    return {startMs, endMs: sceneStartMs + Math.min(sceneDurationMs, elapsedMs), text};
  });
});

export const CaptionOverlay = ({captions, scenes = [], orientation = 'landscape'}: {captions: CaptionCue[]; scenes?: Scene[]; orientation?: 'landscape' | 'portrait'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timeMs = frame / fps * 1000;
  const activeScene = scenes.find((scene) => frame >= scene.startFrame && frame < scene.startFrame + scene.durationInFrames);
  if (activeScene && !activeScene.showCaptions) return null;
  const cue = captions.find((item) => timeMs >= item.startMs && timeMs < item.endMs);
  if (!cue) return null;
  const portrait = orientation === 'portrait';
  return <div style={{position: 'absolute', left: portrait ? 54 : 150, right: portrait ? 54 : 150, bottom: portrait ? 126 : 58, display: 'flex', justifyContent: 'center', pointerEvents: 'none'}}><span style={{maxWidth: portrait ? 920 : 1420, padding: portrait ? '18px 26px' : '13px 24px', borderRadius: 12, background: 'rgba(0,0,0,.76)', color: '#fff', fontSize: portrait ? 38 : 34, lineHeight: 1.35, textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,.25)'}}>{cue.text}</span></div>;
};
