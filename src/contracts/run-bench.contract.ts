// C-22 runBench(options): one per_run entry per requested run; clear_rate is the share of
// successful runs; shares lie in 0..1 and the candidate shares add up to at most 1; time_sec is
// null exactly when nothing cleared; tactics says whether the guide's tactics were used.

import type { BenchOptions } from '../bench/run-bench.ts';
import type { BenchReport } from '../bench/summarize-bench.ts';

const TOLERANCE = 1e-3;

export default {
  post: (report: BenchReport, options: BenchOptions) => {
    if (report.per_run.length !== options.runs || report.runs !== options.runs) return 'run count differs from the request';
    const cleared = report.per_run.filter((run) => run.result === 'success').length;
    if (Math.abs(report.clear_rate - cleared / options.runs) > TOLERANCE) return 'clear_rate is not the share of successful runs';
    if ((report.time_sec === null) !== (cleared === 0)) return 'time_sec null-ness disagrees with the cleared runs';
    const shares = Object.values(report.candidate_share);
    if (shares.some((share) => share < 0 || share > 1)) return 'a candidate share is out of 0..1';
    if (shares.reduce((sum, share) => sum + share, 0) > 1 + TOLERANCE) return 'candidate shares add up to more than 1';
    if (report.exploration_share < 0 || report.exploration_share > 1) return 'exploration_share is out of 0..1';
    return report.tactics === (options.withoutTactics === true ? 'none' : 'guide') || 'tactics flag disagrees with the request';
  },
};
