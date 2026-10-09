// The consideration behind each persona weight (persona.weights keys).

import type { ConsiderationName } from '../persona/persona.ts';
import { confidenceConsideration } from './confidence.ts';
import { distanceConsideration } from './distance.ts';
import { explorationConsideration } from './exploration.ts';
import { hpConsideration } from './hp.ts';
import { intentConsideration } from './intent.ts';
import { metricsConsideration } from './metrics.ts';
import { resourceConsideration } from './resource.ts';
import { timeConsideration } from './time.ts';
import type { Consideration } from './utility-context.ts';

export const CONSIDERATIONS: Readonly<Record<ConsiderationName, Consideration>> = {
  distance: distanceConsideration,
  hp: hpConsideration,
  time: timeConsideration,
  resource: resourceConsideration,
  confidence: confidenceConsideration,
  metrics: metricsConsideration,
  intent: intentConsideration,
  exploration: explorationConsideration,
};
