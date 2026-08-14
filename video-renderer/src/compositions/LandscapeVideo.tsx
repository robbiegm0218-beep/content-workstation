import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {CaptionOverlay} from '../components/CaptionOverlay';
import {buildSceneCaptionCues} from '../components/CaptionOverlay';
import {SceneShell} from '../components/SceneShell';
import {ComparisonScene} from '../scenes/ComparisonScene';
import {FlowScene} from '../scenes/FlowScene';
import {OpeningScene} from '../scenes/OpeningScene';
import {ScreenshotScene} from '../scenes/ScreenshotScene';
import {StatementScene} from '../scenes/StatementScene';
import {SummaryScene} from '../scenes/SummaryScene';
import type {Scene, VideoRenderProps} from '../types';

const sceneComponents = {
  opening: OpeningScene,
  statement: StatementScene,
  flow: FlowScene,
  comparison: ComparisonScene,
  screenshot: ScreenshotScene,
  summary: SummaryScene,
};

export const LandscapeVideo = (plan: VideoRenderProps) => {
  const captions = plan.captions?.length ? plan.captions : buildSceneCaptionCues(plan.scenes, plan.fps);
  return <AbsoluteFill style={{backgroundColor: plan.theme.background}}>
    {plan.audioSrc ? <Audio src={/^(?:blob:|https?:|data:)/.test(plan.audioSrc) ? plan.audioSrc : staticFile(plan.audioSrc)} /> : null}
    {plan.scenes.map((scene: Scene, index: number) => {
      const SceneComponent = sceneComponents[scene.type];
      const resolvedMaterials = scene.materialIds.map((item) => plan.assetUrlMap?.[item] || item);
      const materialKinds = Object.fromEntries(scene.materialIds.map((item, materialIndex) => [resolvedMaterials[materialIndex], plan.assetKindMap?.[item] || (/\.mp4$/i.test(item) ? 'video' : 'image')]));
      const renderedScene = {...scene, materialIds: resolvedMaterials, materialKinds, muteMaterialVideo: Boolean(plan.audioSrc)};
      return (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames} premountFor={30}>
          <SceneShell scene={renderedScene} theme={plan.theme} index={index} totalScenes={plan.scenes.length}>
            <SceneComponent scene={renderedScene} theme={plan.theme} />
          </SceneShell>
        </Sequence>
      );
    })}
    {captions.length ? <CaptionOverlay captions={captions} scenes={plan.scenes} /> : null}
  </AbsoluteFill>;
};
