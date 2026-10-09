import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stripMasked, toPlayerView } from '../../src/bundle/player-view.ts';
import { loadBroken, loadSample } from '../support/bundles.ts';

test('the player view drops masked companions and masked tactics', async () => {
  const view = toPlayerView((await loadSample()).bundle);
  assert.equal(view.maskedEntities.length, 0);
  assert.deepEqual(
    view.tactics.map(({ doc }) => doc.id),
    ['tactic:bestia:kite-wire-spider'],
  );
  assert.ok(!JSON.stringify(view).includes('"masked"'));
});

test('a masked value misplaced in a public file is still stripped', async () => {
  const view = toPlayerView((await loadBroken('v03-masked-outside')).bundle);
  const dragonfly = view.entities.find(({ doc }) => doc.id === 'enemy:bestia:bomber-dragonfly');
  assert.ok(dragonfly);
  assert.equal(dragonfly.doc.stats?.cooldown, undefined);
  assert.ok(dragonfly.doc.stats?.health);
});

test('stripMasked removes masked array items and properties', () => {
  const stripped = stripMasked({ a: [{ knowledge: 'masked' }, { knowledge: 'shown' }], b: { knowledge: 'masked' }, c: 1 });
  assert.deepEqual(stripped, { a: [{ knowledge: 'shown' }], c: 1 });
});
