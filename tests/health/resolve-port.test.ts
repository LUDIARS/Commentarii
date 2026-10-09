import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PORT, resolvePort } from '../../src/health/resolve-port.ts';

test('COMMENTARII_PORT defaults to 4410', () => {
  assert.equal(resolvePort(undefined), DEFAULT_PORT);
  assert.equal(resolvePort(''), 4410);
  assert.equal(resolvePort('5000'), 5000);
});

test('an invalid port fails instead of falling back', () => {
  for (const value of ['0', '70000', 'abc', '12.5', '-1']) assert.throws(() => resolvePort(value), /COMMENTARII_PORT/);
});
