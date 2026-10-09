// One tick of an Action leaf. Leaves are the adapter's abstract actions (design 7.3):
//   move_to  running (emits move_to) until arrived: at the node, or within ARRIVE_DISTANCE of
//            the instance / position; success without an action once there.
//   wait n   running (emits wait 0, one tick) until n seconds of t have passed since it started.
//   others   (attack / use_item / use_skill / interact / custom) emit once and succeed.
// A leaf whose `$binding` cannot be resolved fails.

import type { ObservationFrame, Vector3 } from '../../replay/observation-frame.ts';
import type { ReplayAction } from '../../replay/replay-action.ts';
import type { Bindings } from '../match/bindings.ts';
import { distance } from '../observation/geometry.ts';
import { distanceTo, findInstance } from '../observation/visible-entities.ts';
import type { ActionNode } from './bt-node.ts';
import { clearRange, withMemory, type BtMemory } from './bt-memory.ts';
import { resolveStep } from './resolve-step.ts';
import type { StepResult } from './step-result.ts';

/** Close enough to count as having reached an entity or a point (manifest units). */
export const ARRIVE_DISTANCE = 2;

function hasArrived(target: ReplayAction['move_to'], observation: ObservationFrame): boolean {
  if (typeof target === 'string') return observation.stage.node === target;
  if (typeof target === 'number') {
    const entity = findInstance(observation, target);
    const d = entity === undefined ? undefined : distanceTo(observation, entity);
    return d !== undefined && d <= ARRIVE_DISTANCE;
  }
  const self = observation.self.pos;
  if (target === undefined || self === undefined || target.length !== 3) return false;
  return distance(self, target as Vector3) <= ARRIVE_DISTANCE;
}

export function runActionLeaf(node: ActionNode, memory: BtMemory, observation: ObservationFrame, bindings: Bindings): StepResult {
  const action = resolveStep(node.step, bindings, observation);
  if (action === undefined) return { status: 'failure', memory };
  if (action.move_to !== undefined) {
    return hasArrived(action.move_to, observation) ? { status: 'success', memory } : { status: 'running', action, memory };
  }
  if (action.wait !== undefined) {
    const seconds = typeof action.wait === 'number' ? action.wait : 0;
    if (seconds <= 0) return { status: 'success', action: { wait: 0 }, memory };
    const startedT = memory.get(node.id)?.startedT;
    if (startedT !== undefined && observation.t - startedT >= seconds) return { status: 'success', memory: clearRange(memory, node.id, node.id) };
    return { status: 'running', action: { wait: 0 }, memory: withMemory(memory, node.id, { startedT: startedT ?? observation.t }) };
  }
  return { status: 'success', action, memory };
}
