// Determinism test (design 14.A): feeds the recorded observations to a decider in tick order
// and checks that it returns the recorded action each time. Stops at the first mismatch:
// past it the recorded world no longer follows from what the decider would have done.

import { isDeepStrictEqual } from 'node:util';
import type { Decider } from './decider.ts';
import type { ReplayAction } from './replay-action.ts';
import type { ReplayRun } from './replay-record.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:f559e42c */
import augurContract_7bcd5916 from '../contracts/play-replay.contract.ts'; /* augur-inject:contract-predicate:a55af329 */

export interface PlayOptions {
  /** Last tick to check (inclusive). All ticks when absent. */
  readonly until?: number;
}

export interface PlayMismatch {
  readonly tick: number;
  readonly recorded: ReplayAction;
  readonly replayed: ReplayAction;
}

export interface PlayReport {
  readonly run_id: string;
  readonly decider: string;
  readonly until: number | null;
  /** Ticks fed to the decider, the mismatching one included. */
  readonly ticks_checked: number;
  readonly ok: boolean;
  readonly first_mismatch: PlayMismatch | null;
}

export function playReplay(run: ReplayRun, decider: Decider, options: PlayOptions = {}): PlayReport {
  const until = options.until ?? Number.POSITIVE_INFINITY;
  let checked = 0;
  let mismatch: PlayMismatch | null = null;
  for (const tick of run.ticks) {
    if (tick.tick > until) break;
    checked += 1;
    const replayed = decider.decide(tick.observation).action;
    if (!isDeepStrictEqual(replayed, tick.action)) {
      mismatch = { tick: tick.tick, recorded: tick.action, replayed };
      break;
    }
  }
  return {
    run_id: run.header.run_id,
    decider: decider.id,
    until: options.until ?? null,
    ticks_checked: checked,
    ok: mismatch === null,
    first_mismatch: mismatch,
  };
}
// @ts-expect-error augur-inject
playReplay = contract(playReplay, { ...augurContract_7bcd5916, contractId: 'C-10', mode: 'observe', sample: 1, where: 'src/replay/play-replay.ts:31', rule: 'contract-wrap', id: '7bcd5916' }); /* augur-inject:contract-wrap:7bcd5916 */
