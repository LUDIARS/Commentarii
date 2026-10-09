// Loaded replays -> the runs intent verification may use (spec/feature/intent-verify.md 2):
// player-mode coverage runs and imported human runs. Omniscient runs are never used
// (principle 2) and efficiency runs are not coverage runs; both are only listed. With a
// persona filter, only engine runs of that persona stay.

import type { ReplayRun } from '../../replay/replay-record.ts';

export type RunSide = 'autoplay' | 'human';

/** Persona key of human runs (they have no persona). */
export const HUMAN_PERSONA = 'human';
/** Persona key of engine runs recorded without a persona. */
export const DEFAULT_PERSONA = 'default';

export interface VerifyRun {
  readonly run: ReplayRun;
  /** header.persona, `default`, or `human`. */
  readonly persona: string;
  readonly side: RunSide;
}

export interface RunSelection {
  readonly counted: readonly VerifyRun[];
  readonly ignoredOmniscient: readonly string[];
  readonly ignoredEfficiency: readonly string[];
  /** Left out by --persona. */
  readonly filteredOut: readonly string[];
}

function isHuman(run: ReplayRun): boolean {
  return run.header.source === 'human' || run.header.purpose === 'human';
}

export function selectRuns(runs: readonly ReplayRun[], persona?: string): RunSelection {
  const counted: VerifyRun[] = [];
  const ignoredOmniscient: string[] = [];
  const ignoredEfficiency: string[] = [];
  const filteredOut: string[] = [];
  const sorted = [...runs].sort((a, b) => (a.header.run_id < b.header.run_id ? -1 : a.header.run_id > b.header.run_id ? 1 : 0));
  for (const run of sorted) {
    const id = run.header.run_id;
    if (run.header.mode === 'omniscient') ignoredOmniscient.push(id);
    else if (isHuman(run)) {
      if (persona === undefined) counted.push({ run, persona: HUMAN_PERSONA, side: 'human' });
      else filteredOut.push(id);
    } else if (run.header.purpose !== 'coverage') ignoredEfficiency.push(id);
    else {
      const own = run.header.persona ?? DEFAULT_PERSONA;
      if (persona === undefined || own === persona) counted.push({ run, persona: own, side: 'autoplay' });
      else filteredOut.push(id);
    }
  }
  return { counted, ignoredOmniscient, ignoredEfficiency, filteredOut };
}
