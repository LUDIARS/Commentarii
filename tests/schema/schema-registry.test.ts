import assert from 'node:assert/strict';
import { test } from 'node:test';
import { schemaRegistry } from '../support/bundles.ts';

const value = (extra: Record<string, unknown>) => ({
  id: 'enemy:g:x',
  name: { ja: 'x' },
  stats: { hp: { value: 1, unit: 'hp', knowledge: 'shown', source: { kind: 'master', ref: 'r' }, ...extra } },
});

test('a value needs knowledge and source', async () => {
  const registry = await schemaRegistry();
  assert.deepEqual(registry.validate('entity', value({})), []);
  const withoutKnowledge = value({});
  delete (withoutKnowledge.stats.hp as Record<string, unknown>).knowledge;
  assert.notDeepEqual(registry.validate('entity', withoutKnowledge), []);
});

test('an llm-draft value must stay draft', async () => {
  const registry = await schemaRegistry();
  assert.notDeepEqual(registry.validate('entity', value({ source: { kind: 'llm-draft', ref: 'r' } })), []);
  assert.notDeepEqual(registry.validate('entity', value({ source: { kind: 'llm-draft', ref: 'r' }, draft: false })), []);
  assert.deepEqual(registry.validate('entity', value({ source: { kind: 'llm-draft', ref: 'r' }, draft: true })), []);
});

test('the masked companion accepts masked values only', async () => {
  const registry = await schemaRegistry();
  const masked = (knowledge: string) => ({ id: 'enemy:g:x', stats: { drop: { value: 0.1, knowledge, source: { kind: 'master', ref: 'r' } } } });
  assert.deepEqual(registry.validate('entity.masked', masked('masked')), []);
  assert.notDeepEqual(registry.validate('entity.masked', masked('shown')), []);
});

test('ID patterns reject the wrong kind and malformed IDs', async () => {
  const registry = await schemaRegistry();
  assert.notDeepEqual(registry.validate('entity', { id: 'stage:g:x', name: { ja: 'x' } }), []);
  assert.notDeepEqual(registry.validate('entity', { id: 'enemy:G:x', name: { ja: 'x' } }), []);
  assert.notDeepEqual(registry.validate('entity', { id: 'enemy:g:x', name: { ja: 'x' }, drops: [], category: { value: 'a', knowledge: 'shown', source: { kind: 'human', ref: 'r' } } }), []);
});

test('an overlay observation line (design 4.4 shape) is valid', async () => {
  const registry = await schemaRegistry();
  const observation = {
    t: 12.4,
    tick: 744,
    kind: 'mismatch',
    tactic: 'tactic:bestia:kite-wire-spider',
    expected: { entity_state: 'stunned' },
    observed: { entity_state: 'fleeing' },
    source: 'render-tap',
    mode: 'player',
    purpose: 'efficiency',
  };
  assert.deepEqual(registry.validate('observation', observation), []);
  assert.notDeepEqual(registry.validate('observation', { ...observation, mode: 'god' }), []);
});
