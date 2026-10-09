import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { findValueNodes, isJsonObject } from '../../../src/domain/value-node.ts';
import { pairTables } from '../../../src/import/masters/pair-tables.ts';
import { parseCsvTable } from '../../../src/import/masters/parse-csv.ts';
import { planMasterImport, type MappedTable } from '../../../src/import/masters/plan-master-import.ts';
import { parseMapping } from '../../../src/import/parse-mapping.ts';
import type { FileChange } from '../../../src/import/plan/file-change.ts';
import { loadSample, schemaRegistry } from '../../support/bundles.ts';
import { SAMPLE_CSV, SAMPLE_MAPPING } from '../../support/import-io.ts';

async function sampleTables(): Promise<MappedTable[]> {
  const mapping = parseMapping(await readFile(SAMPLE_MAPPING, 'utf8'), 'mapping.json', await schemaRegistry());
  return pairTables([parseCsvTable(await readFile(SAMPLE_CSV, 'utf8'), 'archetypes.csv')], mapping, 'mapping.json');
}

async function sampleFiles(): Promise<Map<string, unknown>> {
  return new Map((await loadSample()).files.map((file) => [file.path, file.data]));
}

/** The bundle after the changes: current files with the changed ones replaced or removed. */
function applied(existing: ReadonlyMap<string, unknown>, changes: readonly FileChange[]): Map<string, unknown> {
  const files = new Map(existing);
  for (const { path, after } of changes) {
    if (after === undefined) files.delete(path);
    else files.set(path, after);
  }
  return files;
}

/** Master refs differ by design (the stage-1 sample cites the game source, the import the CSV row). */
function withoutMasterRefs(document: unknown): unknown {
  const copy = structuredClone(document);
  for (const { node } of findValueNodes(copy)) {
    if (isJsonObject(node.source) && node.source.kind === 'master') node.source.ref = '<master>';
  }
  return copy;
}

function entityFiles(files: ReadonlyMap<string, unknown>): Map<string, unknown> {
  return new Map([...files].filter(([path]) => path.startsWith('entities/')));
}

test('importing the archetype CSV into the sample reproduces the hand-written stage-1 entities', async () => {
  const existing = await sampleFiles();
  const after = applied(existing, planMasterImport({ gameId: 'bestia', tables: await sampleTables(), existing }));
  const expected = [...entityFiles(existing)].map(([path, doc]) => [path, withoutMasterRefs(doc)]);
  const actual = [...entityFiles(after)].map(([path, doc]) => [path, withoutMasterRefs(doc)]);
  assert.deepEqual(actual, expected);
  const health = (after.get('entities/enemies/wire-spider.json') as { stats: { health: { source: unknown } } }).stats.health;
  assert.deepEqual(health.source, { kind: 'master', ref: 'archetypes.csv#row=2' });
});

test('into an empty bundle, masked columns go to .masked.json only', async () => {
  const changes = planMasterImport({ gameId: 'bestia', tables: await sampleTables(), existing: new Map() });
  assert.deepEqual(changes.map((change) => change.path).sort(), [
    'entities/enemies/bazooka-beetle.json',
    'entities/enemies/bazooka-beetle.masked.json',
    'entities/enemies/bomber-dragonfly.json',
    'entities/enemies/wire-spider.json',
  ]);
  for (const { path, after } of changes) {
    const levels = findValueNodes(after).map(({ node }) => node.knowledge);
    if (path.endsWith('.masked.json')) assert.ok(levels.every((level) => level === 'masked'), path);
    else assert.ok(!levels.includes('masked'), path);
  }
  const masked = changes.find((change) => change.path.endsWith('.masked.json'))?.after as { stats: Record<string, unknown> };
  assert.deepEqual(Object.keys(masked.stats), ['body_mass', 'aim_lead_divisor']);
});

test('re-importing does not take back a promoted boundary', async () => {
  const existing = await sampleFiles();
  const beetle = structuredClone(existing.get('entities/enemies/bazooka-beetle.json')) as { stats: Record<string, Record<string, unknown>> };
  const masked = structuredClone(existing.get('entities/enemies/bazooka-beetle.masked.json')) as { stats: Record<string, unknown> };
  // body_mass was promoted to discoverable after the first import, health to shown.
  beetle.stats.body_mass = { ...(masked.stats.body_mass as object), knowledge: 'discoverable' };
  delete masked.stats.body_mass;
  (beetle.stats.health as { knowledge: string }).knowledge = 'shown';
  existing.set('entities/enemies/bazooka-beetle.json', beetle);
  existing.set('entities/enemies/bazooka-beetle.masked.json', masked);

  const after = applied(existing, planMasterImport({ gameId: 'bestia', tables: await sampleTables(), existing }));
  const publicStats = (after.get('entities/enemies/bazooka-beetle.json') as { stats: Record<string, { knowledge: string }> }).stats;
  const maskedStats = (after.get('entities/enemies/bazooka-beetle.masked.json') as { stats: Record<string, unknown> }).stats;
  assert.equal(publicStats.body_mass?.knowledge, 'discoverable');
  assert.equal(publicStats.health?.knowledge, 'shown');
  assert.deepEqual(Object.keys(maskedStats), ['aim_lead_divisor']);
});

test('observed, human and llm-draft values survive a re-import untouched', async () => {
  const existing = await sampleFiles();
  const spider = structuredClone(existing.get('entities/enemies/wire-spider.json')) as { stats: Record<string, unknown> };
  const observed = { value: 150, unit: 'hp', knowledge: 'discoverable', source: { kind: 'observed', ref: 'run:sample-1 x9' } };
  const drafted = { value: 7.5, unit: 'm/s', knowledge: 'discoverable', source: { kind: 'llm-draft', ref: 'notes.md' }, draft: true };
  spider.stats.health = observed;
  spider.stats.speed = drafted;
  existing.set('entities/enemies/wire-spider.json', spider);

  const after = applied(existing, planMasterImport({ gameId: 'bestia', tables: await sampleTables(), existing }));
  const stats = (after.get('entities/enemies/wire-spider.json') as { stats: Record<string, unknown>; weak_to: unknown[] }).stats;
  assert.deepEqual(stats.health, observed);
  assert.deepEqual(stats.speed, drafted);
  assert.equal((stats.range as { value: number }).value, 19, 'master values are still refreshed');
  assert.equal((after.get('entities/enemies/wire-spider.json') as { weak_to: unknown[] }).weak_to.length, 1, 'the human weak_to stays');
});

test('a second import of the same data changes nothing', async () => {
  const tables = await sampleTables();
  const first = applied(new Map(), planMasterImport({ gameId: 'bestia', tables, existing: new Map() }));
  assert.deepEqual(planMasterImport({ gameId: 'bestia', tables, existing: first }), []);
});

test('a masked companion emptied by a mapping promotion is removed', async () => {
  const [archetypes] = await sampleTables();
  assert.ok(archetypes);
  const promoted: MappedTable = {
    table: archetypes.table,
    mapping: { ...archetypes.mapping, stats: { body_mass: { column: 'body_mass', unit: 'kg', knowledge: 'discoverable' } } },
  };
  const existing = await sampleFiles();
  const masked = structuredClone(existing.get('entities/enemies/bazooka-beetle.masked.json')) as { stats: Record<string, unknown> };
  delete masked.stats.aim_lead_divisor;
  existing.set('entities/enemies/bazooka-beetle.masked.json', masked);

  const changes = planMasterImport({ gameId: 'bestia', tables: [promoted], existing });
  const companion = changes.find((change) => change.path === 'entities/enemies/bazooka-beetle.masked.json');
  assert.ok(companion);
  assert.equal(companion.after, undefined);
});
