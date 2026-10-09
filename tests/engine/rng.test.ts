import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng, deriveSeed, seedToState } from '../../src/engine/rng.ts';

function draw(seed: number | string, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
}

test('the same seed gives the same sequence, in [0, 1)', () => {
  const a = draw(42, 100);
  assert.deepEqual(a, draw(42, 100));
  assert.ok(a.every((value) => value >= 0 && value < 1));
  assert.notDeepEqual(a, draw(43, 100));
});

test('string seeds are hashed deterministically', () => {
  assert.equal(seedToState('run-a'), seedToState('run-a'));
  assert.notEqual(seedToState('run-a'), seedToState('run-b'));
  assert.deepEqual(draw('run-a', 5), draw('run-a', 5));
});

test('the state resumes the sequence', () => {
  const rng = createRng(7);
  rng.next();
  const resumed = createRng(rng.state);
  assert.equal(resumed.next(), rng.next());
});

test('derived seeds are independent per label and stable', () => {
  assert.equal(deriveSeed(1, 'sim'), deriveSeed(1, 'sim'));
  assert.notEqual(deriveSeed(1, 'sim'), deriveSeed(1, 'utility-bt'));
  assert.throws(() => seedToState(Number.NaN), /finite/);
});
