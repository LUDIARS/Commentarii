// Stage leaf of a `when` condition: { "stage": { "id", "node", "elapsed_gt", "elapsed_lt" } },
// every key required. Elapsed seconds come from stage.elapsed (or t when the adapter omits it).

import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { matched, unmatched, type Bindings, type MatchResult } from './bindings.ts';

export function stageElapsed(observation: ObservationFrame): number {
  return observation.stage.elapsed ?? observation.t;
}

function holds(key: string, operand: unknown, observation: ObservationFrame): boolean {
  switch (key) {
    case 'id':
      return observation.stage.id === operand;
    case 'node':
      return observation.stage.node === operand;
    case 'elapsed_gt':
      return typeof operand === 'number' && stageElapsed(observation) > operand;
    case 'elapsed_lt':
      return typeof operand === 'number' && stageElapsed(observation) < operand;
    default:
      return false;
  }
}

export function matchStage(facts: unknown, observation: ObservationFrame, bindings: Bindings): MatchResult {
  if (!isJsonObject(facts) || Object.keys(facts).length === 0) return unmatched();
  return Object.entries(facts).every(([key, operand]) => holds(key, operand, observation)) ? matched(bindings) : unmatched();
}
