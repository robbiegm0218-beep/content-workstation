import {Html5Video, Img, staticFile} from 'remotion';
import type {Scene, Theme} from '../types';

export const ScreenshotScene = ({scene, theme}: {scene: Scene; theme: Theme}) => {
  const material = scene.materialIds[0];
  const source = material ? (/^(?:blob:|https?:|data:)/.test(material) ? material : staticFile(material)) : '';
  const kind = material ? scene.materialKinds?.[material] || (/\.mp4$/i.test(material) ? 'video' : 'image') : null;
  return (
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
      <div style={{height: 420, borderRadius: 24, padding: material ? 0 : 34, overflow: 'hidden', background: '#f6f8fc', color: '#182230'}}>
        {kind === 'video' ? <Html5Video src={source} loop muted={scene.muteMaterialVideo} style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : kind === 'image' ? <Img src={source} style={{width: '100%', height: '100%', objectFit: 'contain'}} /> : <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}><div style={{fontSize: 24, fontWeight: 800}}>{scene.eyebrow || '当前场景'}</div><div style={{display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(3, scene.items.length))}, 1fr)`, gap: 18, marginTop: 28}}>{scene.items.slice(0, 3).map((item, index) => <div key={item} style={{padding: 24, borderRadius: 18, background: 'white'}}><small style={{color: '#68758a'}}>要点 {index + 1}</small><div style={{fontSize: 28, fontWeight: 800, marginTop: 12}}>{item}</div></div>)}</div></div>}
      </div>
    </div>
  </div>
  );
};
