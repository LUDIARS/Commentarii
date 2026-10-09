// guide bench replay (spec/feature/balance-gate.md §4): recorded runs re-decided by the current
// engine and guide (stage 2A play). This is a DECISION regression - did the engine decide the
// same on the same observations - and never a balance or experience result (Astra review P1-6):
// a replay cannot show what the game would have done after a different decision. Runs recorded
// under another decision mode are replayed in theirs (the decider follows the header).

import type { Decider } from '../replay/decider.ts';
import { playReplay } from '../replay/play-replay.ts';
import type { ReplayRun } from '../replay/replay-record.ts';

export interface DivergentRun {
  readonly run_id: string;
  readonly tick: number;
}

export interface DecisionRegression {
  readonly kind: 'decision-regression';
  readonly evidence: 'replay';
  readonly runs: number;
  readonly matched_runs: number;
  readonly run_match_rate: number | null;
  /** Ticks decided the same, over all ticks checked. */
  readonly tick_match_rate: number | null;
  readonly divergent: readonly DivergentRun[];
  /** Always states what the number is not. */
  readonly note: string;
}

export const DECISION_REGRESSION_NOTE = 'decision regression only: same observations, same decisions; not a balance or experience verification';

function rate(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 1e4) / 1e4;
}

export function decisionRegression(runs: readonly ReplayRun[], deciderFor: (run: ReplayRun) => Decider): DecisionRegression {
  let matchedTicks = 0;
  let checkedTicks = 0;
  const divergent: DivergentRun[] = [];
  for (const run of runs) {
    const report = playReplay(run, deciderFor(run));
    checkedTicks += report.ticks_checked;
    matchedTicks += report.ok ? report.ticks_checked : report.ticks_checked - 1;
    if (report.first_mismatch !== null) divergent.push({ run_id: run.header.run_id, tick: report.first_mismatch.tick });
  }
  return {
    kind: 'decision-regression',
    evidence: 'replay',
    runs: runs.length,
    matched_runs: runs.length - divergent.length,
    run_match_rate: rate(runs.length - divergent.length, runs.length),
    tick_match_rate: rate(matchedTicks, checkedTicks),
    divergent,
    note: DECISION_REGRESSION_NOTE,
  };
}
