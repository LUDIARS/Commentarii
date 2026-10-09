// Exploration candidates (design 7.4: "未試行の行動列、定石の変種"):
//   explore:<node>     move to a map node not visited in this run (the unvisited neighbours,
//                      or else the nearest unvisited node).
//   variant:<tactic>   a matched tactic with its steps rotated (last step first): the same
//                      ingredients in another order, the simplest variant that keeps the
//                      tactic's knowledge boundary (it references nothing new).

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { buildTree, stepsTree } from '../bt/build-tree.ts';
import type { ActionStep, BtNode } from '../bt/bt-node.ts';
import type { StageView } from '../world/engine-world.ts';
import type { Candidate } from './candidate.ts';
import { nearestNode } from './map-routes.ts';
import type { RunMemory } from './run-memory.ts';

/** Novelty of a variant that was tried before (new nodes and new variants score 1). */
const TRIED_VARIANT_NOVELTY = 0.3;

function nodeCandidate(node: string): Candidate {
  return {
    id: `explore:${node}`,
    kind: 'explore',
    tree: buildTree({ action: { move_to: node } }),
    bindings: {},
    traits: { targetNode: node, novelty: 1 },
  };
}

function unvisitedNodes(observation: ObservationFrame, stage: StageView | undefined, memory: RunMemory): string[] {
  if (stage === undefined) return [];
  const here = observation.stage.node;
  const isNew = (node: string): boolean => node !== here && !memory.visited.has(node);
  const neighbours = here === undefined ? [] : (stage.adjacency.get(here) ?? []).filter(isNew);
  if (neighbours.length > 0) return neighbours;
  const nearest = nearestNode(stage, here, isNew);
  return nearest === undefined ? [] : [nearest];
}

function stepsOf(tree: BtNode): ActionStep[] | undefined {
  if (tree.type !== 'sequence' || !tree.children.every((child) => child.type === 'action')) return undefined;
  return tree.children.map((child) => (child.type === 'action' ? child.step : {}));
}

function variantOf(candidate: Candidate, memory: RunMemory): Candidate | undefined {
  const steps = stepsOf(candidate.tree);
  if (steps === undefined || steps.length < 2) return undefined;
  const rotated = [...steps.slice(-1), ...steps.slice(0, -1)];
  const id = `variant:${candidate.id}`;
  const { confidence: _confidence, metrics: _metrics, ...traits } = candidate.traits;
  return {
    id,
    kind: 'explore',
    tree: stepsTree(rotated),
    bindings: candidate.bindings,
    traits: { ...traits, novelty: memory.tried.has(id) ? TRIED_VARIANT_NOVELTY : 1 },
  };
}

export function exploreCandidates(
  observation: ObservationFrame,
  stage: StageView | undefined,
  memory: RunMemory,
  tactics: readonly Candidate[],
): Candidate[] {
  const variants = tactics.map((tactic) => variantOf(tactic, memory)).filter((candidate): candidate is Candidate => candidate !== undefined);
  return [...unvisitedNodes(observation, stage, memory).map(nodeCandidate), ...variants];
}
