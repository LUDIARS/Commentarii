import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findKnowledgeHolders, findValueNodes, pointerToFieldPath } from '../../src/domain/value-node.ts';

const document = {
  stats: { hp: { value: 1, knowledge: 'shown', source: { kind: 'master', ref: 'x' } } },
  weak_to: [{ value: { ja: '火' }, knowledge: 'discoverable' }],
  nested: { deeper: [{ value: 2 }] },
  map: { nodes: [{ id: 'node:a', knowledge: 'shown' }] },
};

test('every object with a value key is a value node, however deep', () => {
  const pointers = findValueNodes(document).map((found) => found.pointer);
  assert.deepEqual(pointers, ['/stats/hp', '/weak_to/0', '/nested/deeper/0']);
});

test('knowledge holders include records but not value payloads', () => {
  const pointers = findKnowledgeHolders(document).map((found) => found.pointer);
  assert.deepEqual(pointers, ['/stats/hp', '/weak_to/0', '/map/nodes/0']);
});

test('pointers become field paths without array positions', () => {
  assert.equal(pointerToFieldPath('/stats/hp'), 'stats.hp');
  assert.equal(pointerToFieldPath('/weak_to/0'), 'weak_to');
});
