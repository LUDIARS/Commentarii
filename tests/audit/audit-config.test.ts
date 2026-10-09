import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { allowRuleErrors, DEFAULT_EXTENSIONS, DEFAULT_MIN_NUMERIC_LENGTH, resolveAuditConfig } from '../../src/audit/audit-config.ts';
import { loadSample, schemaRegistry } from '../support/bundles.ts';
import { auditGuideConfig, AUDIT_GUIDE_DIR } from './support.ts';

async function fixtureManifest(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(AUDIT_GUIDE_DIR, 'manifest.json'), 'utf8')) as Record<string, unknown>;
}

test('a manifest without an audit section gets the defaults', async () => {
  const config = resolveAuditConfig((await loadSample()).bundle.manifest?.doc);
  assert.deepEqual(config, { extensions: DEFAULT_EXTENSIONS, minNumericLength: DEFAULT_MIN_NUMERIC_LENGTH, forbiddenKeys: [], allow: [] });
  assert.equal(DEFAULT_MIN_NUMERIC_LENGTH, 3);
});

test('the audit section is read from the manifest', async () => {
  const config = await auditGuideConfig();
  assert.equal(config.minNumericLength, 2);
  assert.deepEqual(config.forbiddenKeys, ['drop_rate', 'rng_seed']);
  assert.equal(config.allow.length, 1);
});

test('the manifest schema accepts the audit section and rejects an allow without rationale or decider', async () => {
  const registry = await schemaRegistry();
  const manifest = await fixtureManifest();
  assert.deepEqual(registry.validate('manifest', manifest), []);
  const audit = manifest['audit'] as { allow: Record<string, unknown>[] };
  for (const missing of ['rationale', 'decided_by']) {
    const allow = { ...audit.allow[0] };
    delete allow[missing];
    assert.ok(registry.validate('manifest', { ...manifest, audit: { ...audit, allow: [allow] } }).length > 0, missing);
  }
  const blank = { ...audit.allow[0], rationale: '   ' };
  assert.ok(registry.validate('manifest', { ...manifest, audit: { ...audit, allow: [blank] } }).length > 0);
});

test('allow rules built in code without rationale or decider are errors too', () => {
  assert.deepEqual(allowRuleErrors([{ pattern: 'a', rationale: 'ok', decided_by: 'neco' }]), []);
  assert.equal(allowRuleErrors([{ pattern: 'a', rationale: ' ', decided_by: '' }]).length, 2);
});
