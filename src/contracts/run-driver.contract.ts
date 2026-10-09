// C-21 runDriver(options): no more ticks than maxTicks; only a game that ended itself gives a
// result other than abort; a masked-in-player stop happens only in player mode and names at
// least one pointer; the chosen counts add up to at most the ticks decided.

import type { DriverOptions, DriverReport } from '../engine/driver.ts';

export default {
  post: (report: DriverReport, options: DriverOptions) => {
    if (report.ticks > options.maxTicks) return `ran ${report.ticks} ticks past the limit ${options.maxTicks}`;
    if (report.stop.reason !== 'game-ended' && report.result !== 'abort') return `stopped by ${report.stop.reason} but result is ${report.result}`;
    if (report.stop.reason === 'masked-in-player') {
      if (options.mode !== 'player') return 'masked-in-player stop outside player mode';
      if (report.stop.pointers.length === 0) return 'masked-in-player stop without a pointer';
    }
    const counted = Object.values(report.chosen).reduce((sum, count) => sum + count, 0);
    return counted <= report.ticks || `counted ${counted} choices for ${report.ticks} ticks`;
  },
};
