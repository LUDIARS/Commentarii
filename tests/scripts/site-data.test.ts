import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { REPO_ROOT } from '../support/bundles.ts';

const workDir = mkdtempSync(join(tmpdir(), 'commentarii-site-'));
after(() => rmSync(workDir, { recursive: true, force: true }));

function site(script: string, args: readonly string[]): number {
  const result = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'site', script), ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return result.status ?? 1;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('export writes the explicit empty format and refuses to overwrite', () => {
  const output = join(workDir, 'export.bundle');
  assert.equal(site('export-data.mjs', ['--output', output]), 0);
  assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), {
    service: 'commentarii',
    format: 'commentarii-data',
    version: 1,
    persistentData: false,
    data: {},
  });
  assert.equal(site('export-data.mjs', ['--output', output]), 1);
  assert.equal(site('export-data.mjs', ['--output', 'relative.bundle']), 1);
});

test('import verifies digest, owner and format', () => {
  const output = join(workDir, 'roundtrip.bundle');
  assert.equal(site('export-data.mjs', ['--output', output]), 0);
  assert.equal(site('import-data.mjs', ['--input', output, '--sha256', sha256(output)]), 0);
  assert.equal(site('import-data.mjs', ['--input', output, '--sha256', '0'.repeat(64)]), 1);
  assert.equal(site('import-data.mjs', ['--input', output]), 1);

  const foreign = join(workDir, 'foreign.bundle');
  writeFileSync(foreign, `${JSON.stringify({ service: 'other', format: 'commentarii-data', version: 1, persistentData: false, data: {} })}\n`);
  assert.equal(site('import-data.mjs', ['--input', foreign, '--sha256', sha256(foreign)]), 1);
});
