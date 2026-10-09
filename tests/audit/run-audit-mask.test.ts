import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AuditReport } from '../../src/audit/audit-report.ts';
import { auditExitCode } from '../../src/audit/audit-exit-code.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import type { LoadResult } from '../../src/bundle/bundle.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import { testImportIo } from '../support/import-io.ts';
import { AUDIT_GAME_DIR, AUDIT_GUIDE_DIR, loadAuditGuide } from './support.ts';

interface Run {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function audit(argv: readonly string[], openBundle: () => Promise<LoadResult> = () => loadAuditGuide()): Promise<Run> {
  let stdout = '';
  let stderr = '';
  const io: CliIo = {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    openBundle,
    writeFiles: async () => {},
    openReplay: openReplayFile,
    importIo: testImportIo(),
    scanSource: fsScanSource,
  };
  const code = await runCli(argv, io);
  return { code, stdout, stderr };
}

const BASE = ['audit', 'mask', '--game', 'audit-guide', '--scan', AUDIT_GAME_DIR];

test('--fail-on hit (the default) exits non-zero when masked values are exposed', async () => {
  assert.notEqual((await audit([...BASE, '--fail-on', 'hit'])).code, 0);
  assert.notEqual((await audit(BASE)).code, 0);
});

test('--fail-on none reports but exits 0', async () => {
  const run = await audit([...BASE, '--fail-on', 'none']);
  assert.equal(run.code, 0);
  assert.match(run.stdout, /^# マスク監査レポート/);
});

test('a clean scan exits 0 even with --fail-on hit', async () => {
  const run = await audit(['audit', 'mask', '--game', 'audit-guide', '--scan', join(AUDIT_GAME_DIR, 'ui', 'legacy-hud.json'), '--fail-on', 'hit']);
  assert.equal(run.code, 0);
  assert.match(run.stdout, /allowed 2/);
});

test('--format json prints { summary, hits, warnings, allowed }', async () => {
  const run = await audit([...BASE, '--format', 'json', '--fail-on', 'none']);
  const report = JSON.parse(run.stdout) as AuditReport;
  assert.deepEqual(Object.keys(report), ['summary', 'hits', 'warnings', 'allowed']);
  assert.equal(report.summary.hits, 8);
  assert.deepEqual(Object.keys(report.hits[0] ?? {}), ['kind', 'file', 'line', 'column', 'ref', 'reason']);
});

test('warnings and allowed findings never fail the gate', () => {
  const warningsOnly: AuditReport = {
    summary: { game_id: 'g', scanned_files: 1, hits: 0, warnings: 1, allowed: 0, by_kind: { 'value-hit': 0, 'key-hit': 0, 'undefined-exposure': 1 } },
    hits: [],
    warnings: [{ kind: 'undefined-exposure', file: 'a.json', line: 1, column: 1, ref: 'literal:250', reason: 'r' }],
    allowed: [],
  };
  assert.equal(auditExitCode(warningsOnly, 'hit'), 0);
  assert.equal(auditExitCode(warningsOnly, 'none'), 0);
});

test('an allow without rationale stops the audit', async () => {
  const manifest = JSON.parse(await readFile(join(AUDIT_GUIDE_DIR, 'manifest.json'), 'utf8')) as { audit: { allow: Record<string, unknown>[] } };
  delete manifest.audit.allow[0]?.['rationale'];
  const run = await audit([...BASE, '--fail-on', 'none'], () => loadAuditGuide({ 'manifest.json': JSON.stringify(manifest) }));
  assert.equal(run.code, 1);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /cannot be used for the audit[\s\S]*manifest\.json/);
});

test('a broken .masked.json stops the audit instead of silently checking less', async () => {
  const run = await audit([...BASE, '--fail-on', 'none'], () => loadAuditGuide({ 'entities/enemies/wire-spider.masked.json': '{ "id": "enemy:bestia:wire-spider", "stats": {' }));
  assert.equal(run.code, 1);
  assert.match(run.stderr, /wire-spider\.masked\.json/);
});

test('usage errors exit 2', async () => {
  for (const argv of [
    ['audit'],
    ['audit', 'other'],
    ['audit', 'mask', '--scan', AUDIT_GAME_DIR],
    ['audit', 'mask', '--game', 'g'],
    [...BASE, '--format', 'html'],
    [...BASE, '--fail-on', 'warning'],
  ]) {
    const run = await audit(argv);
    assert.equal(run.code, 2, argv.join(' '));
    assert.match(run.stderr, /usage:[\s\S]*guide audit mask/);
  }
});
