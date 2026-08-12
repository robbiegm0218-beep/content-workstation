import type {Scene, Theme} from '../types';

export const StatementScene = ({scene, theme}: {scene: Scene; theme: Theme}) => (
  <div style={{display: 'grid', gridTemplateColumns: '1fr 480px', gap: 80, alignItems: 'center', flex: 1}}>
    <div>
      <div style={{fontSize: 28, color: theme.accent, fontWeight: 800}}>{scene.eyebrow}</div>
      <h2 style={{fontSize: 74, lineHeight: 1.16, margin: '24px 0', maxWidth: 1060}}>{scene.headline}</h2>
      <p style={{fontSize: 34, lineHeight: 1.55, color: theme.muted}}>{scene.body}</p>
    </div>
    <div style={{padding: 54, borderRadius: 36, background: theme.surface, border: `2px solid ${theme.primary}`}}>
      <div style={{fontSize: 26, color: theme.muted}}>核心判断</div>
      <div style={{fontSize: 48, lineHeight: 1.3, fontWeight: 900, marginTop: 22, color: theme.accent}}>{scene.emphasis[0]}</div>
    </div>
  </div>
);
