import {Composition} from 'remotion';
import samplePlan from '../fixtures/sample-scene-plan.json';
import {LandscapeVideo} from './compositions/LandscapeVideo';
import {PortraitVideo} from './compositions/PortraitVideo';
import type {VideoScenePlan} from './types';

const dynamicMetadata = ({props}: {props: VideoScenePlan}) => ({width: props.width, height: props.height, fps: props.fps, durationInFrames: props.durationInFrames, props});

export const RemotionRoot = () => {
  const plan = samplePlan as VideoScenePlan;
  const portraitPlan = {...plan, aspectRatio: '9:16', width: 1080, height: 1920} as VideoScenePlan;

  return (
    <><Composition
      id="ContentWorkstationLandscape"
      component={LandscapeVideo}
      width={plan.width}
      height={plan.height}
      fps={plan.fps}
      durationInFrames={plan.durationInFrames}
      defaultProps={plan}
      calculateMetadata={dynamicMetadata}
    /><Composition id="ContentWorkstationPortrait" component={PortraitVideo} width={portraitPlan.width} height={portraitPlan.height} fps={portraitPlan.fps} durationInFrames={portraitPlan.durationInFrames} defaultProps={portraitPlan} calculateMetadata={dynamicMetadata} /></>
  );
};
