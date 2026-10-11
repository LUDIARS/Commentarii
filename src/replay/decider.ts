// The judgement engine as replay sees it: observation in, action (and the candidates weighed)
// out. The Utility / BT engine of stage 3 implements this; replay never depends on how.
// A decider must be deterministic for the same observation sequence (that is what play checks).

import type { DecisionEntry, ObservationFrame, ReplayAction } from '@ludiars/commentarii-sdk/types';

export interface DecisionOutcome {
  readonly decision: readonly DecisionEntry[];
  readonly action: ReplayAction;
}

export interface Decider {
  /** Registry id (`guide replay play --decider <id>`). */
  readonly id: string;
  decide(observation: ObservationFrame): DecisionOutcome;
}
