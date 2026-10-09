// Human runs and autoplay runs -> the per-stage comparison of `guide report plays`.

import type { ReplayRun } from '../../replay/replay-record.ts';
import type { ClassifiedRuns } from './classify-play-runs.ts';
import { MAX_ROUTES, type PlaysReport, type RouteCount, type StageComparison, type StageSide, type TimeSpread } from './plays-report.ts';
import { stageVisits, type StageVisit } from './stage-visits.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:bf664e47 */
import augurContract_29369294 from '../../contracts/build-plays-report.contract.ts'; /* augur-inject:contract-predicate:8e172c0c */

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/** Nearest-rank percentile of a non-empty list. */
function percentile(sorted: readonly number[], fraction: number): number {
  const rank = Math.max(Math.ceil(fraction * sorted.length), 1);
  return sorted[rank - 1] ?? 0;
}

function spread(times: readonly number[]): TimeSpread | null {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  return { p50: round(percentile(sorted, 0.5)), p90: round(percentile(sorted, 0.9)) };
}

function routes(visits: readonly StageVisit[]): RouteCount[] {
  const counts = new Map<string, number>();
  for (const visit of visits) {
    const key = JSON.stringify(visit.route);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, runs]) => ({ path: JSON.parse(key) as string[], runs }))
    .sort((a, b) => b.runs - a.runs || (a.path.join(' ') < b.path.join(' ') ? -1 : a.path.join(' ') > b.path.join(' ') ? 1 : 0))
    .slice(0, MAX_ROUTES);
}

function side(visits: readonly StageVisit[]): StageSide {
  const reached = visits.filter((visit) => visit.reached);
  return {
    runs: visits.length,
    reached: reached.length,
    reach_rate: visits.length === 0 ? null : round(reached.length / visits.length),
    time_sec: spread(reached.flatMap((visit) => (visit.timeSec === undefined ? [] : [visit.timeSec]))),
    routes: routes(visits),
  };
}

function visitsByStage(runs: readonly ReplayRun[]): Map<string, StageVisit[]> {
  const byStage = new Map<string, StageVisit[]>();
  for (const run of runs) {
    for (const visit of stageVisits(run)) byStage.set(visit.stage, [...(byStage.get(visit.stage) ?? []), visit]);
  }
  return byStage;
}

export function buildPlaysReport(gameId: string, runs: ClassifiedRuns): PlaysReport {
  const human = visitsByStage(runs.human);
  const autoplay = visitsByStage(runs.autoplay);
  const stages = [...new Set([...human.keys(), ...autoplay.keys()])].sort();
  const players = new Set(runs.human.map((run) => (typeof run.footer.summary.player === 'string' ? run.footer.summary.player : run.header.run_id)));
  return {
    game_id: gameId,
    human: { runs: runs.human.length, players: players.size },
    autoplay: { runs: runs.autoplay.length, omniscient_excluded: runs.omniscientExcluded },
    skipped_files: runs.skipped,
    stages: stages.map((stage): StageComparison => ({ stage, human: side(human.get(stage) ?? []), autoplay: side(autoplay.get(stage) ?? []) })),
  };
}
// @ts-expect-error augur-inject
buildPlaysReport = contract(buildPlaysReport, { ...augurContract_29369294, contractId: 'C-42', mode: 'observe', sample: 1, where: 'src/import/plays/build-plays-report.ts:55', rule: 'contract-wrap', id: '29369294' }); /* augur-inject:contract-wrap:29369294 */
