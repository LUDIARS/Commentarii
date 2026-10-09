import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateExpression } from '../../../src/domain/expression/evaluate-expression.ts';
import { ExpressionError } from '../../../src/domain/expression/expression-error.ts';

test('arithmetic follows precedence, parentheses and unary minus', () => {
  assert.equal(evaluateExpression('1 + 2 * 3', {}), 7);
  assert.equal(evaluateExpression('(1 + 2) * 3', {}), 9);
  assert.equal(evaluateExpression('-a + 10 / 4', { a: 2 }), 0.5);
  assert.equal(evaluateExpression('2 - -3', {}), 5);
  assert.equal(evaluateExpression('1.5e2 + .5', {}), 150.5);
});

test('builtins min / max / floor / ceil / abs / clamp', () => {
  assert.equal(evaluateExpression('min(4, 2, 9)', {}), 2);
  assert.equal(evaluateExpression('max(4, 2, 9)', {}), 9);
  assert.equal(evaluateExpression('floor(2.7) + ceil(2.1)', {}), 5);
  assert.equal(evaluateExpression('abs(-3)', {}), 3);
  assert.equal(evaluateExpression('clamp(x, 0, 0.45)', { x: 0.9 }), 0.45);
  assert.equal(evaluateExpression('clamp(x, 0, 0.45)', { x: -1 }), 0);
});

test('anything that cannot be evaluated is an ExpressionError', () => {
  const failing = [
    ['a * b', { a: 1 }],
    ['pow(2, 3)', {}],
    ['1 / (a - a)', { a: 3 }],
    ['1 +', {}],
    ['(1 + 2', {}],
    ['1 2', {}],
    ['abs(1, 2)', {}],
    ['clamp(1, 5, 0)', {}],
    ['process.exit(1)', {}],
    ['a; 1', { a: 1 }],
    ['', {}],
  ] as const;
  for (const [source, variables] of failing) {
    assert.throws(() => evaluateExpression(source, variables), ExpressionError, source);
  }
});

test('hostile nesting is rejected instead of exhausting the stack', () => {
  assert.throws(() => evaluateExpression(`${'('.repeat(200)}1${')'.repeat(200)}`, {}), ExpressionError);
  assert.throws(() => evaluateExpression(`${'-'.repeat(200)}1`, {}), ExpressionError);
});
