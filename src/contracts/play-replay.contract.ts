// C-10 playReplay(run, decider, options): ok exactly when there is no mismatch; a full match
// checks every tick up to `until`; a mismatch names a recorded action that differs from the replay.

import { isDeepStrictEqual } from 'node:util';
import type { PlayOptions, PlayReport } from '../replay/play-replay.ts';
import type { ReplayRun } from '../replay/replay-record.ts';

export default {
  post: (report: PlayReport, run: ReplayRun, _decider: unknown, options: PlayOptions = {}) => {
    const until = options.until ?? Number.POSITIVE_INFINITY;
    if (report.ok !== (report.first_mismatch === null)) return 'ok disagrees with first_mismatch';
    const mismatch = report.first_mismatch;
    if (mismatch === null) {
      const expected = run.ticks.filter((tick) => tick.tick <= until).length;
      return report.ticks_checked === expected || `checked ${report.ticks_checked} of ${expected} ticks`;
    }
    if (mismatch.tick > until) return 'mismatch reported past until';
    const recorded = run.ticks.find((tick) => tick.tick === mismatch.tick);
    if (recorded === undefined) return 'mismatch tick is not in the run';
    if (!isDeepStrictEqual(recorded.action, mismatch.recorded)) return 'recorded action is not the one in the run';
    return !isDeepStrictEqual(mismatch.recorded, mismatch.replayed) || 'mismatch with equal actions';
  },
};
