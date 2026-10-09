// A run (human or autoplay replay) -> what it did in each stage: whether it got through, how long
// it took, and the map node route. A stage is got through ("reached" its end) when the run moves
// on to another stage afterwards, or when it is the run's last stage and the run succeeded.
// A stage entered twice is one visit: reached if any stretch was, time of the first one that
// was, routes joined.

import type { ReplayRun, ReplayTick } from '../../replay/replay-record.ts';

export interface StageVisit {
  readonly stage: string;
  readonly reached: boolean;
  /** Seconds from entering the stage to leaving it (or to the last tick); only when reached. */
  readonly timeSec?: number;
  /** Map nodes in visiting order, a repeated node counted once. */
  readonly route: readonly string[];
}

interface Stretch {
  readonly stage: string;
  readonly ticks: ReplayTick[];
}

function stretchesOf(run: ReplayRun): Stretch[] {
  const stretches: Stretch[] = [];
  for (const tick of run.ticks) {
    const current = stretches.at(-1);
    if (current?.stage === tick.observation.stage.id) current.ticks.push(tick);
    else stretches.push({ stage: tick.observation.stage.id, ticks: [tick] });
  }
  return stretches;
}

function routeOf(ticks: readonly ReplayTick[]): string[] {
  const route: string[] = [];
  for (const tick of ticks) {
    const node = tick.observation.stage.node;
    if (node !== undefined && route.at(-1) !== node) route.push(node);
  }
  return route;
}

export function stageVisits(run: ReplayRun): StageVisit[] {
  const stretches = stretchesOf(run);
  const visits = new Map<string, { reached: boolean; timeSec?: number; route: string[] }>();
  stretches.forEach((stretch, index) => {
    const next = stretches[index + 1];
    const reached = next !== undefined || run.footer.result === 'success';
    const start = stretch.ticks[0]?.t ?? 0;
    const end = next?.ticks[0]?.t ?? stretch.ticks.at(-1)?.t ?? start;
    const visit = visits.get(stretch.stage) ?? { reached: false, route: [] };
    if (reached && visit.timeSec === undefined) visit.timeSec = Math.round((end - start) * 1e6) / 1e6;
    visit.reached ||= reached;
    for (const node of routeOf(stretch.ticks)) if (visit.route.at(-1) !== node) visit.route.push(node);
    visits.set(stretch.stage, visit);
  });
  return [...visits].map(([stage, visit]) => ({ stage, reached: visit.reached, ...(visit.timeSec === undefined ? {} : { timeSec: visit.timeSec }), route: visit.route }));
}
