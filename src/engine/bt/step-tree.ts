// BT executor: advances a tree by one tick and returns the action for this tick plus the new
// memory. Pure: the tree is data, the memory is passed in and returned, nothing is global.
//   Sequence  resumes at its remembered child; a child that acted ends the tick.
//   Selector  is reactive: tries children from the first every tick; when another child takes
//             over, the subtree that ran before is forgotten.
//   Condition succeeds or fails on the observation, never acts.

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import type { Bindings } from '../match/bindings.ts';
import { matchCondition } from '../match/match-condition.ts';
import { clearRange, withMemory, type BtMemory } from './bt-memory.ts';
import type { BtNode, SelectorNode, SequenceNode } from './bt-node.ts';
import { runActionLeaf } from './run-action-leaf.ts';
import type { StepResult } from './step-result.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:504d277b */
import augurContract_5725f67e from '../../contracts/step-tree.contract.ts'; /* augur-inject:contract-predicate:a1d4f8dc */

export interface StepContext {
  readonly observation: ObservationFrame;
  readonly bindings: Bindings;
}

function stepSequence(node: SequenceNode, memory: BtMemory, context: StepContext): StepResult {
  let current = memory;
  for (let index = current.get(node.id)?.cursor ?? 0; index < node.children.length; index += 1) {
    const child = node.children[index] as BtNode;
    const result = stepNode(child, current, context);
    current = result.memory;
    if (result.status === 'failure') return { status: 'failure', memory: clearRange(current, node.id, node.last) };
    if (result.status === 'running') return { status: 'running', action: result.action, memory: withMemory(current, node.id, { cursor: index }) };
    if (result.action !== undefined) {
      const done = index + 1 >= node.children.length;
      return done
        ? { status: 'success', action: result.action, memory: clearRange(current, node.id, node.last) }
        : { status: 'running', action: result.action, memory: withMemory(current, node.id, { cursor: index + 1 }) };
    }
  }
  return { status: 'success', memory: clearRange(current, node.id, node.last) };
}

function stepSelector(node: SelectorNode, memory: BtMemory, context: StepContext): StepResult {
  const previous = memory.get(node.id)?.cursor;
  let current = memory;
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index] as BtNode;
    const result = stepNode(child, current, context);
    current = result.memory;
    if (result.status === 'failure') continue;
    if (previous !== undefined && previous !== index) {
      const before = node.children[previous];
      if (before !== undefined) current = clearRange(current, before.id, before.last);
    }
    if (result.status === 'running') return { ...result, memory: withMemory(current, node.id, { cursor: index }) };
    return { ...result, memory: clearRange(current, node.id, node.last) };
  }
  return { status: 'failure', memory: clearRange(current, node.id, node.last) };
}

function stepNode(node: BtNode, memory: BtMemory, context: StepContext): StepResult {
  switch (node.type) {
    case 'sequence':
      return stepSequence(node, memory, context);
    case 'selector':
      return stepSelector(node, memory, context);
    case 'condition':
      return { status: matchCondition(node.when, context.observation, context.bindings).ok ? 'success' : 'failure', memory };
    case 'action':
      return runActionLeaf(node, memory, context.observation, context.bindings);
  }
}

export function stepTree(tree: BtNode, memory: BtMemory, context: StepContext): StepResult {
  return stepNode(tree, memory, context);
}
// @ts-expect-error augur-inject
stepTree = contract(stepTree, { ...augurContract_5725f67e, contractId: 'C-20', mode: 'observe', sample: 1, where: 'src/engine/bt/step-tree.ts:70', rule: 'contract-wrap', id: '5725f67e' }); /* augur-inject:contract-wrap:5725f67e */
