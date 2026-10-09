// C-42 buildPlaysReport(gameId, runs): run counts equal the classified runs; per stage and side,
// reached <= runs, reach_rate = reached / runs (null without runs), a time spread exactly when
// some run got through, and route counts never exceed the runs; stages are unique and sorted.

import type { ClassifiedRuns } from '../import/plays/classify-play-runs.ts';
import type { PlaysReport, StageSide } from '../import/plays/plays-report.ts';

function sideProblem(side: StageSide): string | undefined {
  if (side.reached > side.runs) return 'more runs got through than entered';
  if (side.runs === 0 ? side.reach_rate !== null : Math.abs((side.reach_rate ?? -1) - side.reached / side.runs) > 1e-4) return 'reach_rate is not reached / runs';
  if ((side.time_sec === null) !== (side.reached === 0)) return 'a time spread must exist exactly when some run got through';
  if (side.time_sec !== null && side.time_sec.p50 > side.time_sec.p90) return 'p50 exceeds p90';
  if (side.routes.reduce((sum, route) => sum + route.runs, 0) > side.runs) return 'routes count more runs than entered';
  return undefined;
}

export default {
  post: (report: PlaysReport, _gameId: string, runs: ClassifiedRuns) => {
    if (report.human.runs !== runs.human.length || report.autoplay.runs !== runs.autoplay.length) return 'run counts differ from the classified runs';
    const stages = report.stages.map((stage) => stage.stage);
    if (stages.some((stage, index) => index > 0 && (stages[index - 1] ?? '') >= stage)) return 'stages are not unique and sorted';
    for (const stage of report.stages) {
      const problem = sideProblem(stage.human) ?? sideProblem(stage.autoplay);
      if (problem !== undefined) return `${stage.stage}: ${problem}`;
    }
    return true;
  },
};
