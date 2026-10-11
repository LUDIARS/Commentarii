import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatValidationText } from '../../src/validate/format-validation-text.ts';
import { runValidation } from '../../src/validate/run-validation.ts';
import { loadBroken, loadSample } from '../support/bundles.ts';

test('the sample passes every check', async () => {
  const report = runValidation(await loadSample());
  assert.equal(report.ok, true);
  assert.deepEqual(
    report.checks.map((check) => [check.id, check.status]),
    Array.from({ length: 20 }, (_, i) => [`V${String(i + 1).padStart(2, '0')}`, 'ok']),
  );
});

test('errors fail validation, warnings alone do not', async () => {
  assert.equal(runValidation(await loadBroken('v08-rule-expressions')).ok, false);
  assert.equal(runValidation(await loadBroken('v11-coverage')).ok, true);
});

test('the text report names each check and its findings', async () => {
  const text = formatValidationText(runValidation(await loadBroken('v12-intent-refs')));
  assert.match(text, /^NG {3}V12 /m);
  assert.match(text, /intent\/dome-arena\.json#\/intended\/1\/tactic/);
  assert.match(text, /result: NG/);
});
