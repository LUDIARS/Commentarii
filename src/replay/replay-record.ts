// Lines of replay/<run-id>.jsonl (design 14.A, schema/replay.schema.json):
// one header, then one tick line per engine tick, then one footer.

import type { ObservationFrame, ObservationMode, ObservationPurpose } from './observation-frame.ts';
import type { ReplayAction } from './replay-action.ts';

export interface ReplayHeader {
  readonly type: 'header';
  /** run:<slug> */
  readonly run_id: string;
  readonly seed: number | string;
  readonly game_id: string;
  readonly manifest_version: string;
  readonly adapter_id: string;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  /** human: imported from a human play log (design 14.D); absent for engine runs. */
  readonly source?: 'human';
  readonly persona?: string;
  /** ISO 8601 (UTC). */
  readonly started_at: string;
}

/** One candidate the decider weighed (design 7.4). Stage 2A deciders may log none. */
export interface DecisionEntry {
  readonly candidate: string;
  readonly utility: number;
  readonly chosen: boolean;
}

export interface ReplayTick {
  readonly type: 'tick';
  readonly tick: number;
  readonly t: number;
  readonly observation: ObservationFrame;
  readonly decision: readonly DecisionEntry[];
  readonly action: ReplayAction;
}

export type ReplayResult = 'success' | 'fail' | 'abort';

export interface ReplayFooter {
  readonly type: 'footer';
  readonly ended_at: string;
  readonly result: ReplayResult;
  readonly summary: Readonly<Record<string, unknown>>;
}

export type ReplayLine = ReplayHeader | ReplayTick | ReplayFooter;

export interface ReplayRun {
  readonly header: ReplayHeader;
  readonly ticks: readonly ReplayTick[];
  readonly footer: ReplayFooter;
}

/** The candidate marked chosen, if the decider logged one. */
export function chosenCandidate(tick: ReplayTick): string | undefined {
  return tick.decision.find((entry) => entry.chosen)?.candidate;
}
