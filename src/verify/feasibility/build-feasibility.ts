// One stage's traces -> feasibility/<stage-slug>.json (design 8.5): cluster the solutions, judge
// which look possible from the player export, band them and measure the two good-play axes.
// Only counted (non-omniscient) traces come in; the omniscient runs are only listed. Failed
// attempts without any tactic and outside every intended solution are wandering, not a
// solution: they get no band but still count in confusion depth.

import type { Intent } from '../../domain/documents.ts';
import type { EngineWorld } from '../../engine/world/engine-world.ts';
import type { StageTrace } from '../runs/stage-trace.ts';
import { assignBands } from './assign-bands.ts';
import { clusterSolutions, type IntendedSolution } from './cluster-solutions.ts';
import type { Band, FeasibilityDocument } from './feasibility-document.ts';
import { playAxes } from './play-axes.ts';
import type { FeasibilityThresholds } from './thresholds.ts';
import { generatedTactics, isVisible } from './visible-solutions.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:b989d7c7 */
import augurContract_16c767f8 from '../../contracts/build-feasibility.contract.ts'; /* augur-inject:contract-predicate:8109133c */

export interface FeasibilityInput {
  readonly stage: string;
  readonly stageSlug: string;
  readonly intent?: Intent;
  /** Counted traces of this stage. */
  readonly traces: readonly StageTrace[];
  readonly ignoredOmniscient: readonly string[];
  /** buildEngineWorld(bundle, 'player'). */
  readonly world: EngineWorld;
  /** Map nodes of the stage in the player export. */
  readonly playerNodes: ReadonlySet<string>;
  readonly thresholds: FeasibilityThresholds;
}

function intendedSolutions(intent: Intent | undefined): IntendedSolution[] {
  const solutions: IntendedSolution[] = [];
  for (const item of intent?.intended ?? []) {
    if (item.kind === 'route') solutions.push({ intent: item.id, tactics: [], route: item.path });
    if (item.kind === 'teach') solutions.push({ intent: item.id, tactics: [item.tactic], route: [] });
  }
  return solutions;
}

export function buildFeasibility(input: FeasibilityInput): FeasibilityDocument {
  const traces = input.traces.filter((trace) => trace.stage === input.stage);
  const generated = generatedTactics(input.world, traces.flatMap((trace) => trace.frames));
  const clusters = clusterSolutions(input.stageSlug, traces, intendedSolutions(input.intent))
    .filter((cluster) => cluster.tactics.length > 0 || cluster.intended.length > 0 || cluster.members.some((member) => member.reached))
    .map((cluster) => ({ ...cluster, visible: isVisible(cluster, generated, input.playerNodes) }));
  const solutions = assignBands({ solutions: clusters, thresholds: input.thresholds, byDesign: input.intent?.illusory_by_design ?? [] });
  const bandOfRun = new Map<string, Band>();
  const banded = clusters.map((cluster, index) => {
    const band = solutions[index]?.band ?? 'impossible';
    for (const member of cluster.members) bandOfRun.set(member.run, band);
    return { band, members: cluster.members };
  });
  const stance = input.intent?.design_stance ?? 'unspecified';
  const axes = playAxes({
    traces,
    bandOfRun,
    solutions: banded,
    intendedRoutes: (input.intent?.intended ?? []).flatMap((item) => (item.kind === 'route' ? [item.path] : [])),
    thresholds: input.thresholds,
    stance,
  });
  return {
    stage: input.stage,
    design_stance: stance,
    thresholds: input.thresholds,
    runs: { counted: [...new Set(traces.map((trace) => trace.run))].sort(), ignored_omniscient: [...input.ignoredOmniscient] },
    solutions,
    axes,
  };
}
// @ts-expect-error augur-inject
buildFeasibility = contract(buildFeasibility, { ...augurContract_16c767f8, contractId: 'C-54', mode: 'observe', sample: 1, where: 'src/verify/feasibility/build-feasibility.ts:40', rule: 'contract-wrap', id: '16c767f8' }); /* augur-inject:contract-wrap:16c767f8 */
