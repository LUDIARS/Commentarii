// The two good-play axes per persona of one stage (design 8.5, spec/feature/intent-verify.md 7):
//   breadth          solutions this persona succeeded with (never an illusory / impossible one)
//   confusion_depth  mean over the persona's traces of: a failure (illusory_weight when spent on
//                    an illusory solution, else 1) + stalled seconds x stall_weight + nodes off
//                    every intended route
// Convergence (breadth 1 on a stage that did not declare refined) is reported as a fact only.

import type { StageTrace } from '../runs/stage-trace.ts';
import type { Band, PlayAxes, StanceOrUnspecified } from './feasibility-document.ts';
import type { FeasibilityThresholds } from './thresholds.ts';

export interface AxesInput {
  readonly traces: readonly StageTrace[];
  /** Band of the solution each trace (by run) belongs to; traces outside every solution are absent. */
  readonly bandOfRun: ReadonlyMap<string, Band>;
  /** Solutions with their members' runs and band. */
  readonly solutions: readonly { readonly band: Band; readonly members: readonly StageTrace[] }[];
  /** Paths of the stage's route intents. */
  readonly intendedRoutes: readonly (readonly string[])[];
  readonly thresholds: FeasibilityThresholds;
  readonly stance: StanceOrUnspecified;
}

function deviation(trace: StageTrace, intendedRoutes: readonly (readonly string[])[]): number {
  if (intendedRoutes.length === 0) return 0;
  const intended = new Set(intendedRoutes.flat());
  return new Set(trace.route.filter((node) => !intended.has(node))).size;
}

function traceDepth(trace: StageTrace, input: AxesInput): number {
  const failure = trace.reached ? 0 : input.bandOfRun.get(trace.run) === 'illusory' ? input.thresholds.illusory_weight : 1;
  return failure + trace.stallSec * input.thresholds.stall_weight + deviation(trace, input.intendedRoutes);
}

export function playAxes(input: AxesInput): PlayAxes[] {
  const personas = [...new Set(input.traces.map((trace) => trace.persona))].sort();
  return personas.map((persona) => {
    const own = input.traces.filter((trace) => trace.persona === persona);
    const breadth = input.solutions.filter(
      (solution) => solution.band !== 'illusory' && solution.band !== 'impossible' && solution.members.some((member) => member.persona === persona && member.reached),
    ).length;
    const total = own.reduce((sum, trace) => sum + traceDepth(trace, input), 0);
    return {
      persona,
      breadth,
      confusion_depth: own.length === 0 ? 0 : Math.round((total / own.length) * 1000) / 1000,
      convergence: input.stance !== 'refined' && breadth === 1,
      runs: own.length,
    };
  });
}
