// The two good-play axes per persona of one stage (design 8.5, spec/feature/intent-verify.md 7):
//   breadth          solutions this persona succeeded with (never an illusory / impossible one)
//   observed         what was measured, kept apart from its interpretation (Astra review P2-8):
//                    failed attempts, round trips (back to the node visited two steps before),
//                    stalled seconds, and nodes off every intended route walked by failed attempts
//   confusion_depth  the interpretation, mean over the persona's traces of: a failure
//                    (illusory_weight when spent on an illusory solution, else 1) + stalled seconds
//                    x stall_weight + round trips + off-route nodes of a failed attempt. A run that
//                    got through by another route walked a solution (breadth), not a detour: the
//                    length of an alternative solution is never counted as confusion.
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

interface TraceObservation {
  readonly failures: number;
  readonly round_trips: number;
  readonly stall_sec: number;
  readonly off_route_nodes: number;
}

function offRoute(trace: StageTrace, intendedRoutes: readonly (readonly string[])[]): number {
  if (trace.reached || intendedRoutes.length === 0) return 0;
  const intended = new Set(intendedRoutes.flat());
  return new Set(trace.route.filter((node) => !intended.has(node))).size;
}

function roundTrips(route: readonly string[]): number {
  return route.filter((node, index) => index >= 2 && route[index - 2] === node).length;
}

function observe(trace: StageTrace, input: AxesInput): TraceObservation {
  return { failures: trace.reached ? 0 : 1, round_trips: roundTrips(trace.route), stall_sec: trace.stallSec, off_route_nodes: offRoute(trace, input.intendedRoutes) };
}

function traceDepth(trace: StageTrace, observed: TraceObservation, input: AxesInput): number {
  const failure = observed.failures === 0 ? 0 : input.bandOfRun.get(trace.run) === 'illusory' ? input.thresholds.illusory_weight : 1;
  return failure + observed.stall_sec * input.thresholds.stall_weight + observed.round_trips + observed.off_route_nodes;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function playAxes(input: AxesInput): PlayAxes[] {
  const personas = [...new Set(input.traces.map((trace) => trace.persona))].sort();
  return personas.map((persona) => {
    const own = input.traces.filter((trace) => trace.persona === persona);
    const breadth = input.solutions.filter(
      (solution) => solution.band !== 'illusory' && solution.band !== 'impossible' && solution.members.some((member) => member.persona === persona && member.reached),
    ).length;
    const observations = own.map((trace) => ({ trace, observed: observe(trace, input) }));
    const total = observations.reduce((sum, { trace, observed }) => sum + traceDepth(trace, observed, input), 0);
    const sum = (key: keyof TraceObservation): number => round(observations.reduce((acc, { observed }) => acc + observed[key], 0));
    return {
      persona,
      breadth,
      confusion_depth: own.length === 0 ? 0 : round(total / own.length),
      observed: { failures: sum('failures'), round_trips: sum('round_trips'), stall_sec: sum('stall_sec'), off_route_nodes: sum('off_route_nodes') },
      convergence: input.stance !== 'refined' && breadth === 1,
      runs: own.length,
    };
  });
}
