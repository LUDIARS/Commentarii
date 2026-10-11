// Interval evaluation of expr/2: comparisons decide only when the intervals do not overlap,
// && / || / ! are Kleene's three-valued logic (min / max / 1 - x), if over an unknown condition
// is the hull, division by an interval containing 0 is a model error.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateInterval, evaluateIntervalValue, symbolSet, type IntervalValue } from '@ludiars/commentarii-sdk/expression';

const TRUE = [1, 1];
const FALSE = [0, 0];
const UNKNOWN = [0, 1];

test('[0,10] < 5 is unknown, [0,3] < 5 is true, [6,9] < 5 is false', () => {
  assert.deepEqual(evaluateInterval('x < 5', { variables: { x: [0, 10] } }), UNKNOWN);
  assert.deepEqual(evaluateInterval('x < 5', { variables: { x: [0, 3] } }), TRUE);
  assert.deepEqual(evaluateInterval('x < 5', { variables: { x: [6, 9] } }), FALSE);
  assert.deepEqual(evaluateInterval('x == 5', { variables: { x: [5, 5] } }), TRUE);
  assert.deepEqual(evaluateInterval('x != 5', { variables: { x: [4, 6] } }), UNKNOWN);
});

test('the three-valued tables of && || !', () => {
  const values = { f: [0, 0], u: [0, 1], t: [1, 1] } as const;
  const and: Record<string, readonly number[]> = { ff: FALSE, fu: FALSE, ft: FALSE, uf: FALSE, uu: UNKNOWN, ut: UNKNOWN, tf: FALSE, tu: UNKNOWN, tt: TRUE };
  const or: Record<string, readonly number[]> = { ff: FALSE, fu: UNKNOWN, ft: TRUE, uf: UNKNOWN, uu: UNKNOWN, ut: TRUE, tf: TRUE, tu: TRUE, tt: TRUE };
  for (const [a, left] of Object.entries(values)) {
    for (const [b, right] of Object.entries(values)) {
      const variables = { a: left, b: right };
      assert.deepEqual(evaluateInterval('a && b', { variables }), and[`${a}${b}`], `${a} && ${b}`);
      assert.deepEqual(evaluateInterval('a || b', { variables }), or[`${a}${b}`], `${a} || ${b}`);
    }
    assert.deepEqual(evaluateInterval('!a', { variables: { a: left } }), { f: TRUE, u: UNKNOWN, t: FALSE }[a]);
  }
});

test('a decided left side short-circuits; an undecided one needs the right side', () => {
  assert.deepEqual(evaluateInterval('0 && missing', {}), FALSE);
  assert.deepEqual(evaluateInterval('1 || missing', {}), TRUE);
  assert.throws(() => evaluateInterval('x < 1 && missing', { variables: { x: [0, 2] } }), { name: 'ExpressionError' });
});

test('arithmetic is exact interval arithmetic; points stay points', () => {
  assert.deepEqual(evaluateInterval('x + y', { variables: { x: [1, 2], y: [10, 20] } }), [11, 22]);
  assert.deepEqual(evaluateInterval('x - y', { variables: { x: [1, 2], y: [10, 20] } }), [-19, -8]);
  assert.deepEqual(evaluateInterval('x * y', { variables: { x: [-1, 2], y: [3, 4] } }), [-4, 8]);
  assert.deepEqual(evaluateInterval('x / 2', { variables: { x: [2, 6] } }), [1, 3]);
  assert.deepEqual(evaluateInterval('min(x, 4) + abs(y)', { variables: { x: [1, 9], y: [-3, 2] } }), [1, 7]);
  assert.deepEqual(evaluateInterval('power * cooldown', { variables: { power: 30, cooldown: 0.4 } }), [12, 12]);
});

test('division by an interval that contains 0 is an error, not unknown', () => {
  assert.throws(() => evaluateInterval('1 / x', { variables: { x: [-1, 1] } }), { name: 'ExpressionError', message: /containing 0/ });
  assert.throws(() => evaluateInterval('1 / 0', {}), { name: 'ExpressionError', message: /division by zero/ });
});

test('if over an unknown condition is the hull of both branches', () => {
  assert.deepEqual(evaluateInterval('if(x > 0, 10, 20)', { variables: { x: [-1, 1] } }), [10, 20]);
  assert.deepEqual(evaluateInterval('if(x > 0, 10, missing)', { variables: { x: [1, 2] } }), [10, 10]);
});

test('symbols: sets of possible states compare to an ID token by overlap', () => {
  const mode = (states: readonly string[]) => (): IntervalValue => symbolSet(...states);
  const source = 'mode($target) != state:bestia:battle-ai#dodge';
  const params = { target: 'e:1' };
  assert.deepEqual(evaluateInterval(source, { params, functions: { mode: mode(['state:bestia:battle-ai#chase']) } }), TRUE);
  assert.deepEqual(evaluateInterval(source, { params, functions: { mode: mode(['state:bestia:battle-ai#dodge']) } }), FALSE);
  assert.deepEqual(evaluateInterval(source, { params, functions: { mode: mode(['state:bestia:battle-ai#chase', 'state:bestia:battle-ai#dodge']) } }), UNKNOWN);
  assert.deepEqual(evaluateIntervalValue('$target', { params }), symbolSet('e:1'));
  assert.deepEqual(evaluateInterval('$target == self', { params: { target: 'self' }, symbols: ['self'] }), TRUE);
});

test('context functions receive intervals and symbols, and can return an interval', () => {
  const hp = (args: readonly IntervalValue[]): IntervalValue => (JSON.stringify(args[0]) === JSON.stringify(symbolSet('self')) ? [80, 80] : [0, 140]);
  assert.deepEqual(evaluateInterval('hp(self) > 50', { functions: { hp } }), TRUE);
  assert.deepEqual(evaluateInterval('hp(enemy:bestia:wire-spider) <= 0', { functions: { hp } }), UNKNOWN);
});
