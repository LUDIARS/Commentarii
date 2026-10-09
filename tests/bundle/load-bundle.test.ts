import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBundleFromTexts } from '../../src/bundle/load-bundle.ts';
import { loadSample, schemaRegistry } from '../support/bundles.ts';

test('the sample bundle loads without issues', async () => {
  const { bundle, issues } = await loadSample();
  assert.deepEqual(issues, []);
  assert.equal(bundle.manifest?.doc.game_id, 'bestia');
  assert.equal(bundle.entities.length, 3);
  assert.equal(bundle.maskedEntities.length, 1);
  assert.equal(bundle.stages.length, 1);
  assert.ok(bundle.stages[0]?.map && bundle.stages[0].events);
  assert.equal(bundle.rules.length, 2);
  assert.equal(bundle.states.length, 1);
  assert.equal(bundle.tactics.length, 2);
  assert.equal(bundle.intents.length, 1);
});

test('unknown files, broken JSON and a missing manifest become issues', async () => {
  const registry = await schemaRegistry();
  const result = loadBundleFromTexts(
    [
      { path: 'stray.json', text: '{}' },
      { path: 'tactics/broken.json', text: '{ nope' },
      { path: 'observations/runs/a.jsonl', text: 'ignored' },
      { path: 'notes.md', text: 'ignored' },
    ],
    registry,
  );
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ['stray.json', 'tactics/broken.json', 'manifest.json'],
  );
  assert.equal(result.files.length, 0);
});

test('a UTF-8 byte order mark does not break parsing', async () => {
  const registry = await schemaRegistry();
  const manifest = '﻿{"game_id":"g","title":{"ja":"g"},"version":"1","coordinates":{"system":"grid","unit":"cell"}}';
  const result = loadBundleFromTexts([{ path: 'manifest.json', text: manifest }], registry);
  assert.deepEqual(result.issues, []);
  assert.equal(result.bundle.manifest?.doc.game_id, 'g');
});

test('schema-invalid files stay visible as raw files but not as typed documents', async () => {
  const registry = await schemaRegistry();
  const result = loadBundleFromTexts([{ path: 'entities/enemies/x.json', text: '{"id":"enemy:g:x"}' }], registry);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0]?.schemaValid, false);
  assert.equal(result.bundle.entities.length, 0);
});
