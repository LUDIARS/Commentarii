// expr/2 keeps every expr/1 point value: the sample rules' example evaluations and a set of
// hand-written expr/1 expressions give exactly what the evaluator before expr/2 gave (values
// recorded from that evaluator, packages/sdk at dde85a8). V08 still reads rules as expr/1.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateExpression, parseExpression } from '@ludiars/commentarii-sdk/expression';
import { loadSample } from '../../support/bundles.ts';

/** rule ID -> its example evaluation before expr/2. */
const RULE_VALUES_BEFORE: Readonly<Record<string, number>> = {
  'rule:bestia:dodge-window': 0.3,
  'rule:bestia:wounded-retreat': 45,
  'rule:bestia:damage': 12,
};

const HAND_VALUES_BEFORE: readonly (readonly [string, number])[] = [
  ['-(a + b) * c / 2', 11],
  ['min(a, b, 3) - max(1, 2)', 0],
  ['floor(2.7) + ceil(1.2) + abs(c)', 8],
  ['clamp(x, 0, 0.5) * 10', 5],
  ['+a - -b', 5.5],
  ['1e2 / .5 - a * b', 193],
  ['((a))', 2],
];

test('every sample rule evaluates its examples to the value it had before expr/2', async () => {
  const load = await loadSample();
  const ids = load.bundle.rules.map(({ doc }) => doc.id).sort();
  assert.deepEqual(ids, Object.keys(RULE_VALUES_BEFORE).sort(), 'a sample rule was added or removed: record its value before expr/2');
  for (const { doc } of load.bundle.rules) {
    const examples = Object.fromEntries(Object.entries(doc.variables).map(([name, variable]) => [name, variable.example]));
    assert.equal(evaluateExpression(doc.expression, examples), RULE_VALUES_BEFORE[doc.id], doc.id);
  }
});

test('hand-written expr/1 expressions keep their values and parse to the same tree in both versions', () => {
  const variables = { a: 2, b: 3.5, c: -4, x: 0.7 };
  for (const [source, before] of HAND_VALUES_BEFORE) {
    assert.equal(evaluateExpression(source, variables), before, source);
    assert.deepEqual(parseExpression(source, { language: 'expr/1' }), parseExpression(source, { language: 'expr/2' }), source);
  }
});

test('expr/1 still rejects the expr/2 forms', () => {
  for (const source of ['a < b', 'a && b', '!a', '$x', 'rule(rule:bestia:damage)']) {
    assert.throws(() => parseExpression(source, { language: 'expr/1' }), { name: 'ExpressionError' }, source);
  }
});
