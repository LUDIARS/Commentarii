// Generic actions (design 7.4), always available without any guide knowledge, so the engine
// still plays with an empty guide (weakly):
//   generic:survive   HP low and an enemy in sight -> step away from the nearest one.
//   generic:approach  engage the nearest enemy (attack within reach, else close in); with no
//                     enemy in sight, head for the next node of the intended route.
//   generic:gather    head for the nearest resource node of the map.

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { buildTree } from '../bt/build-tree.ts';
import { pointAway } from '../observation/geometry.ts';
import { hpRatio, reach } from '../observation/self-readings.ts';
import { distanceTo, entitiesOfKind } from '../observation/visible-entities.ts';
import type { StageView } from '../world/engine-world.ts';
import type { Candidate } from './candidate.ts';
import { nearestNode } from './map-routes.ts';
import type { RunMemory } from './run-memory.ts';

/** HP ratio under which surviving becomes a candidate. */
export const SURVIVE_HP_RATIO = 0.3;
/** How far one survive step backs off (manifest units). */
export const FLEE_STEP = 8;
/** Attack reach assumed when the adapter does not report extra.reach. */
export const DEFAULT_REACH = 10;

const TARGET = '$target';

function surviveCandidate(observation: ObservationFrame): Candidate | undefined {
  const ratio = hpRatio(observation);
  const self = observation.self.pos;
  const threat = entitiesOfKind(observation, 'enemy')[0];
  if (ratio === undefined || ratio >= SURVIVE_HP_RATIO || self === undefined || threat?.pos === undefined) return undefined;
  const targetDistance = distanceTo(observation, threat);
  return {
    id: 'generic:survive',
    kind: 'generic',
    tree: buildTree({ action: { move_to: pointAway(self, threat.pos, FLEE_STEP) } }),
    bindings: {},
    traits: { ...(targetDistance === undefined ? {} : { targetDistance }), seeksSafety: true, novelty: 0 },
  };
}

function routeGoal(stage: StageView | undefined, memory: RunMemory): string | undefined {
  for (const item of stage?.intents ?? []) {
    if (item.kind !== 'route') continue;
    const next = item.path.find((node) => !memory.visited.has(node));
    if (next !== undefined) return next;
  }
  return undefined;
}

function approachCandidate(observation: ObservationFrame, stage: StageView | undefined, memory: RunMemory): Candidate | undefined {
  const enemy = entitiesOfKind(observation, 'enemy')[0];
  if (enemy !== undefined) {
    const targetDistance = distanceTo(observation, enemy);
    const engage = {
      selector: [
        { sequence: [{ condition: { entity: TARGET, distance_lt: reach(observation) ?? DEFAULT_REACH } }, { action: { attack: TARGET } }] },
        { action: { move_to: TARGET } },
      ],
    };
    return {
      id: 'generic:approach',
      kind: 'generic',
      tree: buildTree(engage),
      bindings: { [TARGET]: enemy.instance },
      traits: { ...(targetDistance === undefined ? {} : { targetDistance }), progresses: true, novelty: 0 },
    };
  }
  const goal = routeGoal(stage, memory);
  if (goal === undefined || goal === observation.stage.node) return undefined;
  return {
    id: 'generic:approach',
    kind: 'generic',
    tree: buildTree({ action: { move_to: goal } }),
    bindings: {},
    traits: { targetNode: goal, progresses: true, novelty: 0 },
  };
}

function gatherCandidate(observation: ObservationFrame, stage: StageView | undefined): Candidate | undefined {
  if (stage === undefined || stage.resourceNodes.length === 0) return undefined;
  const spots = new Set(stage.resourceNodes);
  const goal = nearestNode(stage, observation.stage.node, (node) => spots.has(node));
  if (goal === undefined || goal === observation.stage.node) return undefined;
  return {
    id: 'generic:gather',
    kind: 'generic',
    tree: buildTree({ action: { move_to: goal } }),
    bindings: {},
    traits: { targetNode: goal, gathers: true, novelty: 0 },
  };
}

export function genericCandidates(observation: ObservationFrame, stage: StageView | undefined, memory: RunMemory): Candidate[] {
  return [surviveCandidate(observation), approachCandidate(observation, stage, memory), gatherCandidate(observation, stage)].filter(
    (candidate): candidate is Candidate => candidate !== undefined,
  );
}
