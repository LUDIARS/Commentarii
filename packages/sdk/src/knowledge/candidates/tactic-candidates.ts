// Tactic candidates: every usable tactic (world.tactics: not draft / superseded, not masked in
// player mode) that the persona trusts, that is not held back, and whose `when` holds now.

import type { Tactic } from '../../domain/documents.ts';
import { isNodeId } from '../../domain/id.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { tacticTree } from '../bt/build-tree.ts';
import type { Bindings } from '../match/bindings.ts';
import { matchCondition } from '../match/match-condition.ts';
import { distanceTo, findInstance } from '../observation/visible-entities.ts';
import { isTrusted, type Persona } from '../persona/persona.ts';
import type { EngineWorld } from '../world/engine-world.ts';
import type { Candidate } from './candidate.ts';
import { isHeldBack, type RunMemory } from './run-memory.ts';

const ACTING_VERBS = ['attack', 'use_skill', 'use_item', 'interact'] as const;

/** Distance to the first bound instance (binding names in order), if any is visible. */
function boundDistance(bindings: Bindings, observation: ObservationFrame): number | undefined {
  for (const name of Object.keys(bindings).sort()) {
    const instance = bindings[name];
    const entity = instance === undefined ? undefined : findInstance(observation, instance);
    const d = entity === undefined ? undefined : distanceTo(observation, entity);
    if (d !== undefined) return d;
  }
  return undefined;
}

function firstNode(tactic: Tactic): string | undefined {
  for (const step of tactic.do) {
    const target = step.move_to;
    if (typeof target === 'string' && isNodeId(target)) return target;
  }
  return undefined;
}

export function tacticCandidate(tactic: Tactic, bindings: Bindings, observation: ObservationFrame, memory: RunMemory): Candidate {
  const targetDistance = boundDistance(bindings, observation);
  const targetNode = firstNode(tactic);
  return {
    id: tactic.id,
    kind: 'tactic',
    tree: tacticTree(tactic),
    bindings,
    expect: tactic.expect,
    traits: {
      ...(targetDistance === undefined ? {} : { targetDistance }),
      ...(targetNode === undefined ? {} : { targetNode }),
      progresses: tactic.do.some((step) => ACTING_VERBS.some((verb) => step[verb] !== undefined)),
      confidence: tactic.confidence,
      ...(tactic.metrics === undefined ? {} : { metrics: tactic.metrics }),
      tactic: tactic.id,
      novelty: memory.tried.has(tactic.id) ? 0 : 1,
    },
  };
}

export function tacticCandidates(world: EngineWorld, persona: Persona, observation: ObservationFrame, memory: RunMemory): Candidate[] {
  const candidates: Candidate[] = [];
  for (const tactic of world.tactics) {
    if (!isTrusted(tactic.confidence, persona.min_confidence)) continue;
    if (isHeldBack(memory, tactic.id, observation.t)) continue;
    const match = matchCondition(tactic.when, observation);
    if (match.ok) candidates.push(tacticCandidate(tactic, match.bindings, observation, memory));
  }
  return candidates;
}
