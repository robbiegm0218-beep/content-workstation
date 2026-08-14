import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {CaptionOverlay, buildSceneCaptionCues} from '../components/CaptionOverlay';
import {PortraitSceneShell} from '../components/PortraitSceneShell';
import {PortraitScene} from '../scenes/PortraitScene';
import type {Scene, VideoRenderProps} from '../types';

export const PortraitVideo = (plan: VideoRenderProps) => {
  const captions = plan.captions?.length ? plan.captions : buildSceneCaptionCues(plan.scenes, plan.fps);
  return <AbsoluteFill style={{backgroundColor: plan.theme.background}}>
    {plan.audioSrc ? <Audio src={/^(?:blob:|https?:|data:)/.test(plan.audioSrc) ? plan.audioSrc : staticFile(plan.audioSrc)} /> : null}
    {plan.scenes.map((scene: Scene, index: number) => {
      const resolvedMaterials = scene.materialIds.map((item) => plan.assetUrlMap?.[item] || item);
      const materialKinds = Object.fromEntries(scene.materialIds.map((item, materialIndex) => [resolvedMaterials[materialIndex], plan.assetKindMap?.[item] || (/\.mp4$/i.test(item) ? 'video' : 'image')]));
      const renderedScene = {...scene, materialIds: resolvedMaterials, materialKinds, muteMaterialVideo: Boolean(plan.audioSrc)};
      return <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames} premountFor={30}><PortraitSceneShell scene={renderedScene} theme={plan.theme} index={index} totalScenes={plan.scenes.length}><PortraitScene scene={renderedScene} theme={plan.theme} /></PortraitSceneShell></Sequence>;
    })}
    {captions.length ? <CaptionOverlay captions={captions} scenes={plan.scenes} orientation="portrait" /> : null}
  </AbsoluteFill>;
};
