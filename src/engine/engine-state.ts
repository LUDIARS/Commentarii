// Everything the engine carries from one tick to the next, as one explicit immutable value
// (no globals): the running plan and its tree memory, the run memory, and the observations
// kept for the persona's reaction delay.

import type { ObservationFrame } from '../replay/observation-frame.ts';
import { EMPTY_MEMORY, type BtMemory } from './bt/bt-memory.ts';
import type { Candidate } from './candidates/candidate.ts';
import { EMPTY_RUN_MEMORY, type RunMemory } from './candidates/run-memory.ts';

export interface RunningPlan {
  readonly candidate: Candidate;
  readonly memory: BtMemory;
  /** t of the observation the plan started on (expect.within_sec counts from here). */
  readonly startedT: number;
  /** The candidate's expect has been met while it ran (nothing left to watch). */
  readonly expectMet?: boolean;
}

export interface EngineState {
  readonly running?: RunningPlan;
  readonly memory: RunMemory;
  /** The last reaction_delay_ticks + 1 observations, oldest first. */
  readonly recent: readonly ObservationFrame[];
}

export const INITIAL_ENGINE_STATE: EngineState = { memory: EMPTY_RUN_MEMORY, recent: [] };

export function newPlan(candidate: Candidate, startedT: number): RunningPlan {
  return { candidate, memory: EMPTY_MEMORY, startedT };
}
