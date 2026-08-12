import type {Scene, Theme} from '../types';

export const ScreenshotScene = ({scene, theme}: {scene: Scene; theme: Theme}) => (
  <div style={{display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 70, alignItems: 'center', flex: 1}}>
    <div>
      <div style={{fontSize: 28, color: theme.accent, fontWeight: 800}}>{scene.eyebrow}</div>
      <h2 style={{fontSize: 70, lineHeight: 1.12, margin: '24px 0'}}>{scene.headline}</h2>
      <p style={{fontSize: 32, color: theme.muted, lineHeight: 1.55}}>{scene.body}</p>
    </div>
    <div style={{padding: 18, borderRadius: 38, background: theme.surface, boxShadow: `0 24px 80px ${theme.primary}28`}}>
      <div style={{height: 48, display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16}}>
        {['#ff6b6b', '#ffd166', '#65e572'].map((color) => <span key={color} style={{width: 14, height: 14, borderRadius: 99, background: color}} />)}
      </div>
      <div style={{height: 420, borderRadius: 24, padding: 34, background: '#f6f8fc', color: '#182230'}}>
        <div style={{fontSize: 24, fontWeight: 800}}>RAG 管理后台 · 评测看板</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 28}}>
          {scene.items.slice(0, 3).map((item, index) => <div key={item} style={{padding: 24, borderRadius: 18, background: 'white'}}><small style={{color: '#68758a'}}>指标 {index + 1}</small><div style={{fontSize: 28, fontWeight: 800, marginTop: 12}}>{item}</div></div>)}
        </div>
        <div style={{height: 170, borderRadius: 18, marginTop: 20, background: 'linear-gradient(135deg, #dff4ff, #efe8ff)', display: 'flex', alignItems: 'end', gap: 18, padding: '24px 32px'}}>
          {[55, 82, 68, 94, 76].map((height, index) => <div key={index} style={{flex: 1, height: `${height}%`, borderRadius: 12, background: index === 3 ? theme.accent : theme.primary}} />)}
        </div>
      </div>
    </div>
  </div>
);
