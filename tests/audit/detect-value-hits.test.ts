import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectValueHits } from '../../src/audit/detect-value-hits.ts';
import type { MaskedNeedle } from '../../src/audit/masked-needles.ts';

const NEEDLES: readonly MaskedNeedle[] = [
  { kind: 'number', ref: 'enemy:g:a.stats.mass', value: 180, unit: 'kg', digits: 3 },
  { kind: 'number', ref: 'enemy:g:a.stats.divisor', value: 32, digits: 2 },
  { kind: 'text', ref: 'enemy:g:a.fields.script', text: 'ambush_b' },
  { kind: 'id-slug', ref: 'enemy:g:a.fields.loot', text: 'silk-gland' },
];

function refs(text: string, minNumericLength = 2): string[] {
  return detectValueHits({ path: 'f.txt', text }, NEEDLES, minNumericLength).map((finding) => finding.ref);
}

test('a number with a unit hits bare or with the same unit, not with another unit', () => {
  assert.deepEqual(refs('mass = 180'), ['enemy:g:a.stats.mass']);
  assert.deepEqual(refs('180 KG'), ['enemy:g:a.stats.mass']);
  assert.deepEqual(refs('180.0kg'), ['enemy:g:a.stats.mass']);
  assert.deepEqual(refs('180 hp'), []);
});

test('numbers below the threshold are not compared', () => {
  assert.deepEqual(refs('1/32', 2), ['enemy:g:a.stats.divisor']);
  assert.deepEqual(refs('1/32', 3), []);
});

test('strings match as whole tokens only; ID values match by slug', () => {
  assert.deepEqual(refs('run ambush_b now'), ['enemy:g:a.fields.script']);
  assert.deepEqual(refs('run ambush_bb now'), []);
  assert.deepEqual(refs('"item:g:silk-gland"'), ['enemy:g:a.fields.loot']);
  assert.deepEqual(refs('silk-glands'), []);
});

test('findings point at the line and column', () => {
  const [finding] = detectValueHits({ path: 'f.txt', text: 'first\n  x = 180' }, NEEDLES, 3);
  assert.equal(finding?.line, 2);
  assert.equal(finding?.column, 7);
});
