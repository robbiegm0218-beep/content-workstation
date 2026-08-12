import type {ReactNode} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import type {Scene, Theme} from '../types';

export const SceneShell = ({
  scene,
  theme,
  index,
  children,
}: {
  scene: Scene;
  theme: Theme;
  index: number;
  children: ReactNode;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16, scene.durationInFrames - 15, scene.durationInFrames - 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, 20], [36, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 82% 18%, ${theme.primary}30, transparent 32%), ${theme.background}`,
        color: theme.text,
        fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
        padding: '72px 92px',
        opacity,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', color: theme.muted, fontSize: 24, letterSpacing: 2}}>
        <span>CONTENT WORKSTATION · VIDEO PROTOTYPE</span>
        <span>{String(index + 1).padStart(2, '0')} / 06</span>
      </div>
      <div style={{display: 'flex', flex: 1, flexDirection: 'column', transform: `translateY(${translateY}px)`}}>{children}</div>
      <div style={{height: 5, borderRadius: 99, background: theme.surface, overflow: 'hidden'}}>
        <div style={{height: '100%', width: `${((index + frame / scene.durationInFrames) / 6) * 100}%`, background: theme.accent}} />
      </div>
    </AbsoluteFill>
  );
};
