import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBundleKind, isNodeId, parseRef } from '../../src/domain/id.ts';

test('parseRef splits kind, game, slug, sub-state and field path', () => {
  assert.deepEqual(parseRef('enemy:bestia:wire-spider.stats.range'), {
    base: 'enemy:bestia:wire-spider',
    kind: 'enemy',
    game: 'bestia',
    slug: 'wire-spider',
    fragment: undefined,
    path: ['stats', 'range'],
  });
  assert.equal(parseRef('state:bestia:battle-ai#chase')?.fragment, 'chase');
  assert.equal(parseRef('intent:bestia:dome-arena:time')?.base, 'intent:bestia:dome-arena:time');
});

test('strings that are not IDs do not parse', () => {
  assert.equal(parseRef('$enemy'), undefined);
  assert.equal(parseRef('run:2026-10-09-003'), undefined);
  assert.equal(parseRef('Enemy:bestia:x'), undefined);
  assert.equal(parseRef('node:center'), undefined);
});

test('map nodes and bundle kinds', () => {
  assert.equal(isNodeId('node:outer-ring'), true);
  assert.equal(isNodeId('node:'), false);
  assert.equal(isBundleKind('tactic'), true);
  assert.equal(isBundleKind('attr'), false);
});
