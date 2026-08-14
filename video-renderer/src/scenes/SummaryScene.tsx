import type {Scene, Theme} from '../types';

export const SummaryScene = ({scene, theme}: {scene: Scene; theme: Theme}) => (
  <div style={{display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
    <div style={{fontSize: 28, color: theme.accent, fontWeight: 800, letterSpacing: 4}}>{scene.eyebrow}</div>
    <h2 style={{fontSize: 86, lineHeight: 1.15, maxWidth: 1400, margin: '30px 0'}}>{scene.headline}</h2>
    <p style={{fontSize: 36, color: theme.muted, lineHeight: 1.5, maxWidth: 1150}}>{scene.body}</p>
    {(scene.emphasis[0] || scene.items[0]) ? <div style={{marginTop: 48, padding: '22px 42px', borderRadius: 99, background: theme.accent, color: theme.background, fontSize: 30, fontWeight: 900}}>{scene.emphasis[0] || scene.items[0]}</div> : null}
  </div>
);
