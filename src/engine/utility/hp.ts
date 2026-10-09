// HP ratio: candidates that seek safety score higher the lower the HP; candidates that push
// forward score higher the healthier self is. Others are not judged on HP.

import { hpRatio } from '../observation/self-readings.ts';
import type { Consideration } from './utility-context.ts';

export const hpConsideration: Consideration = (candidate, { observation }) => {
  const ratio = hpRatio(observation);
  if (ratio === undefined) return undefined;
  if (candidate.traits.seeksSafety === true) return 1 - ratio;
  if (candidate.traits.progresses === true) return ratio;
  return undefined;
};
