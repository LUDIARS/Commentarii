// Exploration candidates of the map (design 7.4: "未試行の行動列"):
//   explore:<node>     move to a map node not visited in this run (the unvisited neighbours,
//                      or else the nearest unvisited node).
// Variants of tactics ("定石の変種") are the other exploration candidates (variant-candidates.ts).

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { buildTree } from '../bt/build-tree.ts';
import type { StageView } from '../world/engine-world.ts';
import type { Candidate } from './candidate.ts';
import { nearestNode } from './map-routes.ts';
import type { RunMemory } from './run-memory.ts';

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

export function exploreCandidates(observation: ObservationFrame, stage: StageView | undefined, memory: RunMemory): Candidate[] {
  return unvisitedNodes(observation, stage, memory).map(nodeCandidate);
}
