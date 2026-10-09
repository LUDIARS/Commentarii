import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_MEMORY, type BtMemory } from '../../../src/engine/bt/bt-memory.ts';
import type { BtNode } from '../../../src/engine/bt/bt-node.ts';
import { buildTree, stepsTree } from '../../../src/engine/bt/build-tree.ts';
import { stepTree, type StepContext } from '../../../src/engine/bt/step-tree.ts';
import type { StepResult } from '../../../src/engine/bt/step-result.ts';
import { enemy, frame, SPIDER } from '../../support/personas.ts';

function run(tree: BtNode, contexts: readonly StepContext[]): StepResult[] {
  let memory: BtMemory = EMPTY_MEMORY;
  return contexts.map((context) => {
    const result = stepTree(tree, memory, context);
    memory = result.memory;
    return result;
  });
}

test('ids are pre-order and each node knows the end of its subtree', () => {
  const tree = buildTree({ selector: [{ sequence: [{ condition: { event: 'hit' } }, { action: { wait: 0 } }] }, { action: { wait: 0 } }] });
  assert.equal(tree.id, 0);
  assert.equal(tree.last, 4);
  assert.equal(tree.type === 'selector' ? tree.children[0]?.last : -1, 3);
  assert.throws(() => buildTree({ sequence: [] }), /at least one child/);
});

test('a sequence acts once per tick and resumes where it stopped', () => {
  const tree = stepsTree([{ move_to: 'node:outer-ring' }, { attack: '$enemy' }]);
  const bindings = { $enemy: 2 };
  const spider = [enemy(SPIDER, 2, 10)];
  const results = run(tree, [
    { observation: frame({ tick: 0, entities: spider }), bindings },
    { observation: frame({ tick: 1, entities: spider }), bindings },
    { observation: frame({ tick: 2, node: 'node:outer-ring', entities: spider }), bindings },
  ]);
  assert.deepEqual(results.map((result) => [result.status, result.action]), [
    ['running', { move_to: 'node:outer-ring' }],
    ['running', { move_to: 'node:outer-ring' }],
    ['success', { attack: 2 }],
  ]);
  assert.equal(results[2]?.memory.size, 0, 'a finished sequence forgets its cursor');
});

test('wait runs for its seconds of observation time, then the sequence moves on', () => {
  const tree = stepsTree([{ wait: 0.3 }, { custom: 'taunt' }]);
  const results = run(tree, [0, 1, 2, 3].map((tick) => ({ observation: frame({ tick }), bindings: {} })));
  assert.deepEqual(results.map((result) => result.action), [{ wait: 0 }, { wait: 0 }, { wait: 0 }, { custom: 'taunt' }]);
  assert.equal(results[3]?.status, 'success');
});

test('a leaf whose binding is gone fails the sequence without acting', () => {
  const tree = stepsTree([{ attack: '$enemy' }]);
  const [result] = run(tree, [{ observation: frame(), bindings: { $enemy: 9 } }]);
  assert.deepEqual([result?.status, result?.action], ['failure', undefined]);
  const [unbound] = run(tree, [{ observation: frame({ entities: [enemy(SPIDER, 9, 5)] }), bindings: {} }]);
  assert.equal(unbound?.status, 'failure');
});

test('a selector is reactive: the first child that can act wins every tick', () => {
  const tree = buildTree({
    selector: [
      { sequence: [{ condition: { entity: '$target', distance_lt: 20 } }, { action: { attack: '$target' } }] },
      { action: { move_to: '$target' } },
    ],
  });
  const bindings = { $target: 2 };
  const results = run(tree, [
    { observation: frame({ entities: [enemy(SPIDER, 2, 30)] }), bindings },
    { observation: frame({ entities: [enemy(SPIDER, 2, 15)] }), bindings },
  ]);
  assert.deepEqual(results.map((result) => result.action), [{ move_to: 2 }, { attack: 2 }]);
});

test('move_to succeeds without acting once there (node, instance or point)', () => {
  const at = (step: object, observation = frame()) => stepTree(buildTree({ action: step }), EMPTY_MEMORY, { observation, bindings: { $e: 2 } });
  assert.deepEqual(at({ move_to: 'node:mid-ring' }).status, 'success');
  assert.deepEqual(at({ move_to: '$e' }, frame({ entities: [enemy(SPIDER, 2, 1.5)] })).status, 'success');
  assert.deepEqual(at({ move_to: [1, 0, 0] }).status, 'success');
  assert.deepEqual(at({ move_to: [10, 0, 0] }).action, { move_to: [10, 0, 0] });
});
