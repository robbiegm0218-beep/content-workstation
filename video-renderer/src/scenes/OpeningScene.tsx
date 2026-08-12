import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Scene, Theme} from '../types';

export const OpeningScene = ({scene, theme}: {scene: Scene; theme: Theme}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame, fps, config: {damping: 18, stiffness: 110}, durationInFrames: 35});
  return (
    <div style={{marginTop: 135, maxWidth: 1450}}>
      <div style={{fontSize: 30, color: theme.accent, fontWeight: 800, letterSpacing: 4}}>{scene.eyebrow}</div>
      <h1 style={{fontSize: 112, lineHeight: 1.04, margin: '28px 0', transform: `scale(${scale})`, transformOrigin: 'left center'}}>{scene.headline}</h1>
      <p style={{fontSize: 40, lineHeight: 1.5, color: theme.muted, maxWidth: 1180}}>{scene.body}</p>
    </div>
  );
};
