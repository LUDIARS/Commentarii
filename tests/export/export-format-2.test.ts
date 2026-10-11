// bundle.json format 2: documents.mechanics (the rulebook), index.actions, view and the
// expression language version. A player export keeps no masked override; a full one keeps them
// apart, never applied.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXPORT_FORMAT_VERSION } from '@ludiars/commentarii-sdk/types';
import { buildExport } from '../../src/export/build-export.ts';
import { loadSample } from '../support/bundles.ts';

test('format 2 carries the rulebook, the view and expr/2', async () => {
  const exported = buildExport(await loadSample(), { knowledge: 'player', target: 'runtime' });
  assert.equal(EXPORT_FORMAT_VERSION, 2);
  assert.equal(exported.format_version, 2);
  assert.equal(exported.view, 'player');
  assert.equal(exported.expression_language, 'expr/2');
  const { mechanics } = exported.documents;
  assert.ok(mechanics.variables);
  assert.ok(mechanics.objectives);
  assert.deepEqual(mechanics.actions.map(({ doc }) => doc.id), ['action:bestia:dodge', 'action:bestia:move', 'action:bestia:retreat', 'action:bestia:return', 'action:bestia:shoot']);
  assert.deepEqual(mechanics.masked_actions, []);
  assert.equal(mechanics.processes.length, 1);
  assert.equal(mechanics.behaviors.length, 1);
});

test('index.actions gives each action its actor and adapter verb', async () => {
  const exported = buildExport(await loadSample(), { knowledge: 'player', target: 'runtime' });
  assert.deepEqual(exported.index.actions['action:bestia:shoot'], { path: 'mechanics/actions/shoot.json', pointer: '/documents/mechanics/actions/4', actor: ['self', 'entity'], maps_to: 'attack' });
  assert.equal(exported.index.actions['action:bestia:dodge']?.maps_to, 'custom');
  assert.equal(exported.index.ids['behavior:bestia:battle-ai']?.kind, 'behavior');
  assert.equal(exported.index.ids['process:bestia:regen']?.kind, 'process');
});

test('a full export keeps the masked override apart from the visible action', async () => {
  const exported = buildExport(await loadSample(), { knowledge: 'full', target: 'runtime' });
  assert.equal(exported.view, 'full');
  assert.deepEqual(exported.documents.mechanics.masked_actions.map(({ path }) => path), ['mechanics/actions/shoot.masked.json']);
  const shoot = exported.documents.mechanics.actions.find(({ doc }) => doc.id === 'action:bestia:shoot');
  assert.equal(JSON.stringify(shoot).includes('evaded'), false);
});
