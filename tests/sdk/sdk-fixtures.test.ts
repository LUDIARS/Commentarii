// The SDK fixtures (packages/sdk/fixtures/) that Commentarii and Ingenium tests share: the
// bundle.json exports must stay what `guide export` writes for samples/bestia today, the player
// one masked-free; the replays must parse; the observation lines must follow observation.schema.json.

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  FIXTURE_BUNDLES,
  FIXTURE_REPLAYS,
  fixtureObservationRunsDirectory,
  readFixtureBundle,
  readFixtureReplay,
} from '@ludiars/commentarii-sdk/fixtures';
import { buildExport } from '../../src/export/build-export.ts';
import { loadSample, schemaRegistry } from '../support/bundles.ts';
import { parseText } from '../replay/replay-fixtures.ts';

function hasMasked(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMasked);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.knowledge === 'masked' || Object.values(record).some(hasMasked);
}

test('the bundle fixtures equal what guide export writes for samples/bestia now', async () => {
  const load = await loadSample();
  for (const knowledge of FIXTURE_BUNDLES) {
    const fixture = await readFixtureBundle(knowledge);
    const exported = JSON.parse(JSON.stringify(buildExport(load, { knowledge, target: 'runtime' }))) as unknown;
    assert.deepEqual(fixture, exported, `bundle.${knowledge}.json is stale: re-export samples/bestia with --knowledge ${knowledge}`);
  }
});

test('the player bundle fixture holds no masked value, the full one keeps them', async () => {
  const player = await readFixtureBundle('player');
  assert.equal(hasMasked(player), false);
  assert.equal(player.documents.masked_entities.length, 0);
  const full = await readFixtureBundle('full');
  assert.equal(hasMasked(full), true);
  assert.ok(full.documents.masked_entities.length > 0);
});

test('every replay fixture parses without issues', async () => {
  for (const name of FIXTURE_REPLAYS) {
    const loaded = await parseText(await readFixtureReplay(name));
    assert.deepEqual(loaded.issues, [], name);
    assert.ok(loaded.run !== undefined, name);
  }
});

test('every observation fixture line follows observation.schema.json', async () => {
  const registry = await schemaRegistry();
  const directory = fixtureObservationRunsDirectory();
  const files = (await readdir(directory)).filter((name) => name.endsWith('.jsonl'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const lines = (await readFile(join(directory, file), 'utf8')).split(/\r?\n/).filter((line) => line.trim() !== '');
    for (const [index, line] of lines.entries()) {
      assert.deepEqual(registry.validate('observation', JSON.parse(line) as unknown), [], `${file}:${index + 1}`);
    }
  }
});
