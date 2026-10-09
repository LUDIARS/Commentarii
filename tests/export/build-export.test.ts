import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildExport, exportFiles } from '../../src/export/build-export.ts';
import { loadBroken, loadSample } from '../support/bundles.ts';

function hasMasked(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMasked);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.knowledge === 'masked' || Object.values(record).some(hasMasked);
}

test('a player export contains no masked value at all', async () => {
  const exported = buildExport(await loadSample(), { knowledge: 'player', target: 'runtime' });
  assert.equal(exported.knowledge, 'player');
  assert.equal(exported.documents.masked_entities.length, 0);
  assert.equal(hasMasked(exported), false);
  const text = exportFiles(exported).get('bundle.json') ?? '';
  assert.doesNotMatch(text, /"masked"/);
  assert.doesNotMatch(text, /aim_lead_divisor|body_mass|sidestep-lead-shot/);
});

test('even a masked value misplaced outside .masked.json stays out of a player export', async () => {
  const exported = buildExport(await loadBroken('v03-masked-outside'), { knowledge: 'player', target: 'runtime' });
  assert.equal(hasMasked(exported), false);
});

test('a full export keeps the masked companion files and masked tactics', async () => {
  const exported = buildExport(await loadSample(), { knowledge: 'full', target: 'runtime' });
  assert.equal(exported.documents.masked_entities.length, 1);
  assert.ok(exported.documents.tactics.some(({ doc }) => doc.id === 'tactic:bestia:sidestep-lead-shot'));
  assert.equal(hasMasked(exported), true);
});

test('the index locates every record, reverses render signatures and lists stage adjacency', async () => {
  const exported = buildExport(await loadSample(), { knowledge: 'player', target: 'runtime' });
  const { ids, adjacency } = exported.index;
  assert.deepEqual(ids['tactic:bestia:kite-wire-spider'], { kind: 'tactic', path: 'tactics/kite-wire-spider.json', pointer: '/documents/tactics/0' });
  assert.equal(ids['enemy:bestia:wire-spider']?.kind, 'entity');
  assert.equal(ids['intent:bestia:dome-arena:learn-kite']?.kind, 'intent');
  assert.equal(ids['tactic:bestia:sidestep-lead-shot'], undefined);
  assert.deepEqual(adjacency['stage:bestia:dome-arena'], {
    'node:center': ['node:mid-ring'],
    'node:mid-ring': ['node:center', 'node:outer-ring'],
    'node:outer-ring': ['node:mid-ring', 'node:outside'],
    'node:outside': ['node:outer-ring'],
  });
  assert.equal(exported.game_id, 'bestia');
  assert.equal(exported.target, 'runtime');
});

test('render signatures map draw IDs back to entities', async () => {
  const load = await loadSample();
  const [first, ...rest] = load.bundle.entities;
  assert.ok(first);
  const signed = { ...first, doc: { ...first.doc, render_signature: { mesh: 'mesh:bestia:spider_body', sprite: 'sprite:bestia:spider_icon' } } };
  const exported = buildExport({ ...load, bundle: { ...load.bundle, entities: [signed, ...rest] } }, { knowledge: 'player', target: 'runtime' });
  assert.deepEqual(exported.index.render_signatures, { 'mesh:bestia:spider_body': first.doc.id, 'sprite:bestia:spider_icon': first.doc.id });
});
