// Loaded replays -> the runs intent verification may use (spec/feature/intent-verify.md 2):
// player-mode coverage runs and imported human runs. Omniscient runs are never used
// (principle 2) and efficiency runs are not coverage runs; both are only listed. With a
// persona filter, only engine runs of that persona stay. Intent-assisted engine runs (the decider
// was given the designer's intent, spec/feature/engine.md §4.1) are an answer-key test, not a
// persona's ability: they are listed apart and never classified or banded (Astra review P1-4).

import type { ReplayRun } from '../../replay/replay-record.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:6dceb975 */
import augurContract_66af0cef from '../../contracts/select-runs.contract.ts'; /* augur-inject:contract-predicate:fb434504 */

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
  /** Engine runs recorded with decision_mode intent-assisted. */
  readonly ignoredIntentAssisted: readonly string[];
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
  const ignoredIntentAssisted: string[] = [];
  const filteredOut: string[] = [];
  const sorted = [...runs].sort((a, b) => (a.header.run_id < b.header.run_id ? -1 : a.header.run_id > b.header.run_id ? 1 : 0));
  for (const run of sorted) {
    const id = run.header.run_id;
    if (run.header.mode === 'omniscient') ignoredOmniscient.push(id);
    else if (isHuman(run)) {
      if (persona === undefined) counted.push({ run, persona: HUMAN_PERSONA, side: 'human' });
      else filteredOut.push(id);
    } else if (run.header.decision_mode === 'intent-assisted') ignoredIntentAssisted.push(id);
    else if (run.header.purpose !== 'coverage') ignoredEfficiency.push(id);
    else {
      const own = run.header.persona ?? DEFAULT_PERSONA;
      if (persona === undefined || own === persona) counted.push({ run, persona: own, side: 'autoplay' });
      else filteredOut.push(id);
    }
  }
  return { counted, ignoredOmniscient, ignoredEfficiency, ignoredIntentAssisted, filteredOut };
}
// @ts-expect-error augur-inject
selectRuns = contract(selectRuns, { ...augurContract_66af0cef, contractId: 'C-70', mode: 'observe', sample: 1, where: 'src/verify/runs/select-runs.ts:38', rule: 'contract-wrap', id: '66af0cef' }); /* augur-inject:contract-wrap:66af0cef */
