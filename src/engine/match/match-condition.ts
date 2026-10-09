// Evaluates a tactic `when` (schema/tactic.schema.json condition) against one observation.
// Composites: all (bindings flow left to right), any (first branch that holds), not (binds
// nothing). Leaves: entity / self / stage / event. The match is greedy (no backtracking): an
// entity leaf binds the nearest instance that satisfies it.

import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { matched, NO_BINDINGS, unmatched, type Bindings, type MatchResult } from './bindings.ts';
import { matchEntity } from './match-entity.ts';
import { matchSelf } from './match-self.ts';
import { matchStage } from './match-stage.ts';

function matchAll(items: unknown, observation: ObservationFrame, bindings: Bindings): MatchResult {
  if (!Array.isArray(items) || items.length === 0) return unmatched();
  let current = bindings;
  for (const item of items) {
    const result = matchCondition(item, observation, current);
    if (!result.ok) return unmatched();
    current = result.bindings;
  }
  return matched(current);
}

function matchAny(items: unknown, observation: ObservationFrame, bindings: Bindings): MatchResult {
  if (!Array.isArray(items) || items.length === 0) return unmatched();
  for (const item of items) {
    const result = matchCondition(item, observation, bindings);
    if (result.ok) return result;
  }
  return unmatched();
}

/** { "event": "<kind>" }: an event of that kind arrived with this observation. */
function matchEvent(kind: unknown, observation: ObservationFrame, bindings: Bindings): MatchResult {
  return typeof kind === 'string' && observation.events.some((event) => event.kind === kind) ? matched(bindings) : unmatched();
}

function onlyKey(condition: Readonly<Record<string, unknown>>, key: string): boolean {
  const keys = Object.keys(condition);
  return keys.length === 1 && keys[0] === key;
}

export function matchCondition(condition: unknown, observation: ObservationFrame, bindings: Bindings = NO_BINDINGS): MatchResult {
  if (!isJsonObject(condition)) return unmatched();
  if (onlyKey(condition, 'all')) return matchAll(condition.all, observation, bindings);
  if (onlyKey(condition, 'any')) return matchAny(condition.any, observation, bindings);
  if (onlyKey(condition, 'not')) return matchCondition(condition.not, observation, bindings).ok ? unmatched() : matched(bindings);
  if (Object.hasOwn(condition, 'entity')) return matchEntity(condition, observation, bindings);
  if (onlyKey(condition, 'self')) return matchSelf(condition.self, observation, bindings);
  if (onlyKey(condition, 'stage')) return matchStage(condition.stage, observation, bindings);
  if (onlyKey(condition, 'event')) return matchEvent(condition.event, observation, bindings);
  // Outside the vocabulary: never holds, so an unknown condition cannot trigger a tactic.
  return unmatched();
}
