import type {Scene, Theme} from '../types';

export const ComparisonScene = ({scene, theme}: {scene: Scene; theme: Theme}) => (
  <div style={{display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center'}}>
    <div style={{fontSize: 28, color: theme.accent, fontWeight: 800}}>{scene.eyebrow}</div>
    <h2 style={{fontSize: 74, margin: '20px 0 55px'}}>{scene.headline}</h2>
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34}}>
      {scene.items.slice(0, 2).map((item, index) => (
        <div key={item} style={{minHeight: 250, padding: 46, borderRadius: 34, background: index === 0 ? theme.surface : `${theme.primary}24`, border: `2px solid ${index === 0 ? theme.muted : theme.primary}`}}>
          <div style={{fontSize: 24, color: index === 0 ? theme.muted : theme.accent}}>{scene.emphasis[index] || `对比 ${index + 1}`}</div>
          <div style={{fontSize: 46, lineHeight: 1.35, fontWeight: 850, marginTop: 24}}>{item}</div>
        </div>
      ))}
    </div>
  </div>
);
