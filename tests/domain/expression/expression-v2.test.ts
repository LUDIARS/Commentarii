// expr/2 at a point: comparison, logic (short-circuit), if, ID tokens, $params, context
// functions and aggregates, each in one test.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateExpression, parseExpression, type PointValue } from '@ludiars/commentarii-sdk/expression';

test('comparisons give 1 or 0', () => {
  const cases: readonly (readonly [string, number])[] = [
    ['2 < 3', 1],
    ['3 < 3', 0],
    ['3 <= 3', 1],
    ['3 == 3', 1],
    ['3 != 3', 0],
    ['4 >= 5', 0],
    ['5 > 4', 1],
    ['1 + 1 == 2', 1],
  ];
  for (const [source, expected] of cases) assert.equal(evaluateExpression(source, {}), expected, source);
});

test('&& || ! short-circuit: the undecided side is never evaluated', () => {
  assert.equal(evaluateExpression('0 && missing', {}), 0);
  assert.equal(evaluateExpression('1 || missing', {}), 1);
  assert.equal(evaluateExpression('!0 && 2', {}), 1);
  assert.equal(evaluateExpression('!(1 < 2) || 0', {}), 0);
  assert.throws(() => evaluateExpression('1 && missing', {}), { name: 'ExpressionError' });
});

test('if(c, a, b) evaluates only the branch it takes', () => {
  assert.equal(evaluateExpression('if(x > 0, 10, missing)', { x: 1 }), 10);
  assert.equal(evaluateExpression('if(x > 0, missing, -10)', { x: 0 }), -10);
  assert.throws(() => evaluateExpression('if(1, 2)', {}), { name: 'ExpressionError' });
});

test('an ID token is one symbol and compares by equality only', () => {
  const tree = parseExpression('mode(self) != state:bestia:battle-ai#dodge');
  assert.equal(tree.type, 'compare');
  const mode = (): PointValue => 'state:bestia:battle-ai#chase';
  assert.equal(evaluateExpression('mode(self) != state:bestia:battle-ai#dodge', {}, { functions: { mode } }), 1);
  assert.equal(evaluateExpression('mode(self) == state:bestia:battle-ai#chase', {}, { functions: { mode } }), 1);
  assert.throws(() => evaluateExpression('rule:bestia:damage < 1', {}), { name: 'ExpressionError' });
  assert.throws(() => evaluateExpression('rule:bestia:damage', {}), { name: 'ExpressionError' });
});

test('$params bind numbers and symbols; an unbound one is an error', () => {
  assert.equal(evaluateExpression('$for * 2', {}, { params: { for: 0.5 } }), 1);
  assert.equal(evaluateExpression('$target == self', {}, { params: { target: 'self' }, symbols: ['self'] }), 1);
  assert.throws(() => evaluateExpression('$for', {}), { name: 'ExpressionError' });
});

test('context functions receive values and symbols; unknown functions stay errors', () => {
  const seen: PointValue[][] = [];
  const hp = (args: readonly PointValue[]): PointValue => {
    seen.push([...args]);
    return args[0] === 'self' ? 80 : 40;
  };
  const rule = (args: readonly PointValue[]): PointValue => (args[0] === 'rule:bestia:damage' ? 12 : 0);
  assert.equal(evaluateExpression('hp(self) - rule(rule:bestia:damage)', {}, { functions: { hp, rule } }), 68);
  assert.equal(evaluateExpression('hp($target)', {}, { functions: { hp }, params: { target: 'e:2' } }), 40);
  assert.deepEqual(seen, [['self'], ['e:2']]);
  assert.throws(() => evaluateExpression('dist(1, 2)', {}), { name: 'ExpressionError', message: /unknown function 'dist'/ });
});

test('aggregates are context functions over a set name and a variable name', () => {
  const members: Readonly<Record<string, number>> = { a: 30, b: 50 };
  const functions = {
    count: (args: readonly PointValue[]): PointValue => (args[0] === 'hostile' ? Object.keys(members).length : 0),
    sum: (args: readonly PointValue[]): PointValue => (args[0] === 'hostile' && args[1] === 'hp' ? Object.values(members).reduce((x, y) => x + y, 0) : 0),
  };
  assert.equal(evaluateExpression('count(hostile) == 2 && sum(hostile, hp) == 80', {}, { functions }), 1);
});
