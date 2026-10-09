import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findNumericLiterals, significantDigits, significantDigitsOfNumber } from '../../src/audit/numeric-literal.ts';

test('significant digits ignore sign, decimal point and leading zeros', () => {
  assert.equal(significantDigits('180'), 3);
  assert.equal(significantDigits('0.24'), 2);
  assert.equal(significantDigits('-32'), 2);
  assert.equal(significantDigitsOfNumber(1.35), 3);
  assert.equal(significantDigitsOfNumber(18), 2);
});

test('literals carry the unit written right after them', () => {
  const literals = findNumericLiterals('weighs 18 kg, runs 7m/s, shots 1/32');
  assert.deepEqual(
    literals.map((literal) => [literal.text, literal.unit, literal.column]),
    [
      ['18', 'kg', 8],
      ['7', 'm/s', 20],
      ['1', undefined, 32],
      ['32', undefined, 34],
    ],
  );
});

test('identifiers and version strings are not numbers', () => {
  assert.deepEqual(findNumericLiterals('v2 item_180 build 1.2.3 x86').map((literal) => literal.text), []);
  assert.deepEqual(findNumericLiterals('-420 N').map((literal) => [literal.value, literal.unit]), [[420, 'N']]);
});
