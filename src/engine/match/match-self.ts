// Self leaf of a `when` condition (design 4.4): { "self": { ... } } with every key required:
//   hp_ratio_lt / hp_ratio_gt (HP bar 0..1), skill_ready (skill ID), has_item (item ID),
//   resource_gte / resource_lt ({ name: amount }), at_node (node ID).
// Unknown facts (no hp in the observation) never satisfy a comparison.

import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { heldItemCount, hpRatio, readySkills, resourceAmount } from '../observation/self-readings.ts';
import { matched, unmatched, type Bindings, type MatchResult } from './bindings.ts';

type SelfCheck = (operand: unknown, observation: ObservationFrame) => boolean;

function compareResources(operand: unknown, observation: ObservationFrame, holds: (amount: number, bound: number) => boolean): boolean {
  if (!isJsonObject(operand) || Object.keys(operand).length === 0) return false;
  return Object.entries(operand).every(([name, bound]) => {
    const amount = resourceAmount(observation, name);
    return typeof bound === 'number' && amount !== undefined && holds(amount, bound);
  });
}

const SELF_CHECKS: ReadonlyMap<string, SelfCheck> = new Map<string, SelfCheck>([
  ['hp_ratio_lt', (operand, observation) => {
    const ratio = hpRatio(observation);
    return typeof operand === 'number' && ratio !== undefined && ratio < operand;
  }],
  ['hp_ratio_gt', (operand, observation) => {
    const ratio = hpRatio(observation);
    return typeof operand === 'number' && ratio !== undefined && ratio > operand;
  }],
  ['skill_ready', (operand, observation) => typeof operand === 'string' && readySkills(observation).includes(operand)],
  ['has_item', (operand, observation) => typeof operand === 'string' && heldItemCount(observation, operand) > 0],
  ['resource_gte', (operand, observation) => compareResources(operand, observation, (amount, bound) => amount >= bound)],
  ['resource_lt', (operand, observation) => compareResources(operand, observation, (amount, bound) => amount < bound)],
  ['at_node', (operand, observation) => typeof operand === 'string' && observation.stage.node === operand],
]);

export const SELF_FACTS: readonly string[] = [...SELF_CHECKS.keys()];

export function matchSelf(facts: unknown, observation: ObservationFrame, bindings: Bindings): MatchResult {
  if (!isJsonObject(facts) || Object.keys(facts).length === 0) return unmatched();
  for (const [key, operand] of Object.entries(facts)) {
    const check = SELF_CHECKS.get(key);
    if (check === undefined || !check(operand, observation)) return unmatched();
  }
  return matched(bindings);
}
