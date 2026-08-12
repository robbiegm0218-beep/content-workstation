import {interpolate, useCurrentFrame} from 'remotion';
import type {Scene, Theme} from '../types';

export const FlowScene = ({scene, theme}: {scene: Scene; theme: Theme}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center'}}>
      <div style={{fontSize: 28, color: theme.accent, fontWeight: 800}}>{scene.eyebrow}</div>
      <h2 style={{fontSize: 74, margin: '20px 0 66px'}}>{scene.headline}</h2>
      <div style={{display: 'flex', gap: 22, alignItems: 'stretch'}}>
        {scene.items.map((item, index) => {
          const opacity = interpolate(frame, [index * 13, index * 13 + 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          return (
            <div key={item} style={{flex: 1, opacity, padding: '38px 28px', borderRadius: 28, background: theme.surface, borderTop: `7px solid ${index === scene.items.length - 1 ? theme.accent : theme.primary}`}}>
              <div style={{fontSize: 24, color: theme.muted}}>STEP {index + 1}</div>
              <div style={{fontSize: 36, lineHeight: 1.3, fontWeight: 800, marginTop: 18}}>{item}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
