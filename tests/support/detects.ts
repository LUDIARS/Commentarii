// Shared assertion of the per-item validate tests: the broken fixture trips exactly the
// expected check, and the clean sample does not.

import assert from 'node:assert/strict';
import type { CheckId, Severity } from '../../src/validate/check.ts';
import { runValidation } from '../../src/validate/run-validation.ts';
import { loadBroken, loadSample } from './bundles.ts';

export async function assertDetects(id: CheckId, fixture: string, severity: Severity = 'error'): Promise<void> {
  const broken = runValidation(await loadBroken(fixture)).checks.find((check) => check.id === id);
  assert.ok(broken, `${id} is missing from the report`);
  assert.equal(broken.status, severity, `${id} should report ${severity} for ${fixture}`);
  assert.ok(broken.findings.length > 0);
  assert.ok(broken.findings.every((finding) => finding.severity === severity));

  const clean = runValidation(await loadSample()).checks.find((check) => check.id === id);
  assert.equal(clean?.status, 'ok', `${id} should pass on the sample`);
}
