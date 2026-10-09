import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ImportError } from '../../../src/import/import-error.ts';
import { buildImportedEntities } from '../../../src/import/masters/build-imported-entities.ts';
import type { MasterTable } from '../../../src/import/masters/master-table.ts';
import { slugify } from '../../../src/import/masters/slug-of.ts';
import type { TableMapping } from '../../../src/import/mapping.ts';

const table = (cells: Record<string, unknown>[]): MasterTable => ({
  name: 'things',
  columns: [...new Set(cells.flatMap((row) => Object.keys(row)))],
  rows: cells.map((row, index) => ({ ref: `things.csv#row=${index + 1}`, cells: row })),
});

test('slugify turns display text into an ID slug', () => {
  assert.equal(slugify('Bazooka Beetle'), 'bazooka-beetle');
  assert.equal(slugify('  Ｈｅａｌ  Potion!! '), 'heal-potion');
});

test('kind may come from a column, and render_signature materials are split', () => {
  const mapping: TableMapping = {
    kind: { column: 'type', values: { monster: 'enemy', potion: 'item' } },
    id: { column: 'name', slugify: true },
    name: { en: 'name' },
    render_signature: { mesh: 'mesh', material: 'materials' },
    stats: { hp: { column: 'hp', unit: 'hp', knowledge: 'shown' }, price: { column: 'price' } },
  };
  const entities = buildImportedEntities(
    table([
      { type: 'monster', name: 'Cave Bat', mesh: 'mesh:g:bat', materials: 'mat:g:wing | mat:g:fur', hp: '12', price: '' },
      { type: 'potion', name: 'Heal Potion', mesh: '', materials: '', hp: '', price: 30 },
    ]),
    mapping,
    'g',
  );
  assert.deepEqual(
    entities.map((entity) => [entity.id, entity.group]),
    [
      ['enemy:g:cave-bat', 'enemies'],
      ['item:g:heal-potion', 'items'],
    ],
  );
  assert.deepEqual(entities[0]?.renderSignature, { mesh: 'mesh:g:bat', material: ['mat:g:wing', 'mat:g:fur'] });
  assert.deepEqual(entities[0]?.stats.get('hp'), { value: 12, unit: 'hp', knowledge: 'shown', source: { kind: 'master', ref: 'things.csv#row=1' } });
  assert.equal(entities[0]?.stats.has('price'), false, 'an empty cell leaves the value out');
  assert.equal(entities[1]?.stats.get('price')?.knowledge, 'masked', 'knowledge defaults to masked');
  assert.equal(entities[1]?.renderSignature, undefined);
});

test('missing columns, unmapped kinds, non-slug IDs and non-numbers fail with the row', () => {
  const base: TableMapping = { kind: 'enemy', id: { column: 'slug' }, name: { ja: 'name' }, stats: { hp: { column: 'hp' } } };
  assert.throws(() => buildImportedEntities(table([{ slug: 'a', name: 'A' }]), base, 'g'), /no column 'hp'/);
  assert.throws(() => buildImportedEntities(table([{ slug: 'Big A', name: 'A', hp: 1 }]), base, 'g'), /slugify/);
  assert.throws(() => buildImportedEntities(table([{ slug: 'a', name: 'A', hp: 'lots' }]), base, 'g'), /row=1.*not a number/);
  assert.throws(() => buildImportedEntities(table([{ slug: 'a', name: '', hp: 1 }]), base, 'g'), ImportError);
  const byColumn: TableMapping = { ...base, kind: { column: 'type', values: { monster: 'enemy' } } };
  assert.throws(() => buildImportedEntities(table([{ type: 'boss', slug: 'a', name: 'A', hp: 1 }]), byColumn, 'g'), /kind 'boss'/);
});
