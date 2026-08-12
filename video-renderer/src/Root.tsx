import {Composition} from 'remotion';
import samplePlan from '../fixtures/sample-scene-plan.json';
import {LandscapeVideo} from './compositions/LandscapeVideo';
import type {VideoScenePlan} from './types';

export const RemotionRoot = () => {
  const plan = samplePlan as VideoScenePlan;

  return (
    <Composition
      id="ContentWorkstationLandscape"
      component={LandscapeVideo}
      width={plan.width}
      height={plan.height}
      fps={plan.fps}
      durationInFrames={plan.durationInFrames}
      defaultProps={plan}
    />
  );
};
