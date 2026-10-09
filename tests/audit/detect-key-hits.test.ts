import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectKeyHits, keySpellings } from '../../src/audit/detect-key-hits.ts';

test('snake_case keys are also looked up in camelCase and PascalCase', () => {
  assert.deepEqual(keySpellings('rng_seed').map((spelling) => spelling.text), ['rng_seed', 'rngSeed', 'RngSeed']);
  assert.deepEqual(keySpellings('seed').map((spelling) => spelling.text), ['seed', 'Seed']);
});

test('forbidden keys hit as JSON keys, fields and properties, not inside longer identifiers', () => {
  const text = ['{ "drop_rate": 0.1 }', 'message Loot { float drop_rate = 3; }', 'public float DropRate { get; }', 'int drop_rate_ui;', 'dropRateLabel'].join('\n');
  const hits = detectKeyHits({ path: 'f', text }, ['drop_rate']);
  assert.deepEqual(
    hits.map((hit) => hit.line),
    [1, 2, 3],
  );
  assert.ok(hits.every((hit) => hit.ref === 'forbidden_keys:drop_rate' && hit.kind === 'key-hit'));
});
