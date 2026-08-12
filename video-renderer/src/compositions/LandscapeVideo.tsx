import {AbsoluteFill, Sequence} from 'remotion';
import {SceneShell} from '../components/SceneShell';
import {ComparisonScene} from '../scenes/ComparisonScene';
import {FlowScene} from '../scenes/FlowScene';
import {OpeningScene} from '../scenes/OpeningScene';
import {ScreenshotScene} from '../scenes/ScreenshotScene';
import {StatementScene} from '../scenes/StatementScene';
import {SummaryScene} from '../scenes/SummaryScene';
import type {Scene, VideoScenePlan} from '../types';

const sceneComponents = {
  opening: OpeningScene,
  statement: StatementScene,
  flow: FlowScene,
  comparison: ComparisonScene,
  screenshot: ScreenshotScene,
  summary: SummaryScene,
};

export const LandscapeVideo = (plan: VideoScenePlan) => (
  <AbsoluteFill style={{backgroundColor: plan.theme.background}}>
    {plan.scenes.map((scene: Scene, index: number) => {
      const SceneComponent = sceneComponents[scene.type];
      return (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames} premountFor={30}>
          <SceneShell scene={scene} theme={plan.theme} index={index}>
            <SceneComponent scene={scene} theme={plan.theme} />
          </SceneShell>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
