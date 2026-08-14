import type {ReactNode} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import type {Scene, Theme} from '../types';
import {sceneTransitionFrames} from '../timing.mjs';

export const PortraitSceneShell = ({scene, theme, index, totalScenes, children}: {scene: Scene; theme: Theme; index: number; totalScenes: number; children: ReactNode}) => {
  const frame = useCurrentFrame();
  const {fadeInEnd, fadeOutStart, lastFrame, translateEnd} = sceneTransitionFrames(scene.durationInFrames);
  const opacity = interpolate(frame, [0, fadeInEnd, fadeOutStart, lastFrame], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const translateY = interpolate(frame, [0, translateEnd], [46, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: `radial-gradient(circle at 84% 10%, ${theme.primary}38, transparent 27%), ${theme.background}`, color: theme.text, fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif', padding: '78px 62px 92px', opacity}}>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: theme.muted, fontSize: 21, letterSpacing: 1.5}}><span>CONTENT WORKSTATION</span><span>{String(index + 1).padStart(2, '0')} / {String(totalScenes).padStart(2, '0')}</span></div>
    <div style={{display: 'flex', flex: 1, flexDirection: 'column', transform: `translateY(${translateY}px)`, paddingBottom: scene.showCaptions ? 175 : 34}}>{children}</div>
    <div style={{height: 7, borderRadius: 99, background: theme.surface, overflow: 'hidden'}}><div style={{height: '100%', width: `${((index + frame / scene.durationInFrames) / totalScenes) * 100}%`, background: theme.accent}} /></div>
  </AbsoluteFill>;
};
