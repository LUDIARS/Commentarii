import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import { SAMPLE_DIR } from '../support/bundles.ts';

interface Captured {
  readonly io: CliIo;
  readonly stdout: () => string;
  readonly stderr: () => string;
  readonly written: Map<string, ReadonlyMap<string, string>>;
}

function capture(): Captured {
  let out = '';
  let err = '';
  const written = new Map<string, ReadonlyMap<string, string>>();
  return {
    io: {
      stdout: (text) => (out += text),
      stderr: (text) => (err += text),
      openBundle: openBundleDir,
      writeFiles: async (outDir, files) => {
        written.set(outDir, files);
      },
    },
    stdout: () => out,
    stderr: () => err,
    written,
  };
}

test('validate on the sample exits 0 and reports every check OK', async () => {
  const run = capture();
  assert.equal(await runCli(['validate', SAMPLE_DIR], run.io), 0);
  assert.match(run.stdout(), /result: OK/);
  assert.equal(run.stdout().match(/^OK {3}V\d\d /gm)?.length, 12);
});

test('validate --json prints the machine report', async () => {
  const run = capture();
  await runCli(['validate', SAMPLE_DIR, '--json'], run.io);
  const report = JSON.parse(run.stdout()) as { ok: boolean; checks: { id: string }[] };
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 12);
});

test('render writes the page set to --out', async () => {
  const run = capture();
  assert.equal(await runCli(['render', SAMPLE_DIR, '--out', 'out-dir'], run.io), 0);
  assert.ok(run.written.get('out-dir')?.has('enemies.md'));
  assert.equal(run.written.get('out-dir')?.has('masked.md'), false);
});

test('report knowledge prints Markdown, or JSON with --json', async () => {
  const markdown = capture();
  await runCli(['report', 'knowledge', SAMPLE_DIR], markdown.io);
  assert.match(markdown.stdout(), /^# 知識境界レポート/);
  const json = capture();
  await runCli(['report', 'knowledge', SAMPLE_DIR, '--json'], json.io);
  assert.equal((JSON.parse(json.stdout()) as { totals: { total: number } }).totals.total, 18);
});

test('usage errors exit 2', async () => {
  for (const argv of [['bogus'], ['validate'], ['render', SAMPLE_DIR], ['render', SAMPLE_DIR, '--out', 'x', '--knowledge', 'all'], ['report', 'other', SAMPLE_DIR]]) {
    const run = capture();
    assert.equal(await runCli(argv, run.io), 2, argv.join(' '));
    assert.match(run.stderr(), /usage:/);
  }
});
