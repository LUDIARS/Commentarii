// What every consideration may look at besides the candidate itself.

import type { ObservationFrame, ObservationPurpose } from '../../replay/observation-frame.ts';
import type { Candidate } from '../candidates/candidate.ts';
import type { EngineWorld, StageView } from '../world/engine-world.ts';

export interface UtilityContext {
  readonly observation: ObservationFrame;
  readonly world: EngineWorld;
  readonly stage: StageView | undefined;
  readonly purpose: ObservationPurpose;
  /** Exploration bonus active this tick (always in coverage, exploration_rate of efficiency ticks). */
  readonly exploring: boolean;
}

/** A consideration scores a candidate in 0..1, or undefined when it has nothing to say about it. */
export type Consideration = (candidate: Candidate, context: UtilityContext) => number | undefined;

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
