// Entity leaf of a `when` condition (design 4.4):
//   { "entity": "<entity ID>" | "$binding", "visible": bool, "distance_lt": n, "distance_gt": n,
//     "state": "<state ref>", "min_confidence": 0..1, "as": "$name" }
// An ID matches the nearest visible instance that satisfies every key and binds it (as `as`, or
// `$<kind>`); a binding re-checks the instance bound earlier. visible:false holds when no
// instance satisfies the rest. Unknown keys never match (the vocabulary is closed).

import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservationFrame, ObservedEntity } from '../../replay/observation-frame.ts';
import { distanceTo, findInstance, sortByDistance } from '../observation/visible-entities.ts';
import { defaultBindingName, isBindingName, matched, unmatched, type Bindings, type MatchResult } from './bindings.ts';

const ENTITY_KEYS = new Set(['entity', 'visible', 'distance_lt', 'distance_gt', 'state', 'min_confidence', 'as']);

function satisfies(observation: ObservationFrame, entity: ObservedEntity, leaf: Readonly<Record<string, unknown>>): boolean {
  const d = distanceTo(observation, entity);
  if (typeof leaf.distance_lt === 'number' && !(d !== undefined && d < leaf.distance_lt)) return false;
  if (typeof leaf.distance_gt === 'number' && !(d !== undefined && d > leaf.distance_gt)) return false;
  if (typeof leaf.state === 'string' && entity.state_guess !== leaf.state) return false;
  if (typeof leaf.min_confidence === 'number' && (entity.confidence ?? 1) < leaf.min_confidence) return false;
  return true;
}

function hasOnlyKnownKeys(leaf: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(leaf).every((key) => ENTITY_KEYS.has(key));
}

export function matchEntity(leaf: unknown, observation: ObservationFrame, bindings: Bindings): MatchResult {
  if (!isJsonObject(leaf) || !hasOnlyKnownKeys(leaf) || typeof leaf.entity !== 'string') return unmatched();
  const wantVisible = leaf.visible !== false;
  let found: ObservedEntity | undefined;
  if (isBindingName(leaf.entity)) {
    const instance = bindings[leaf.entity];
    const entity = instance === undefined ? undefined : findInstance(observation, instance);
    found = entity !== undefined && satisfies(observation, entity, leaf) ? entity : undefined;
  } else {
    const id = leaf.entity;
    found = sortByDistance(observation, observation.entities.filter((entity) => entity.entity === id)).find((entity) => satisfies(observation, entity, leaf));
  }
  if (!wantVisible) return found === undefined ? matched(bindings) : unmatched();
  if (found === undefined) return unmatched();
  const name = isBindingName(leaf.as) ? leaf.as : isBindingName(leaf.entity) ? leaf.entity : defaultBindingName(leaf.entity);
  return matched(name === undefined ? bindings : { ...bindings, [name]: found.instance });
}
