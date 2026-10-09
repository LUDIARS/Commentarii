import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { loadPersona } from '../../src/adapters/fs/load-persona.ts';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { createReplayFileWriter } from '../../src/adapters/fs/replay-file-writer.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { createStreamLineChannel } from '../../src/adapters/stdio/line-channel.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import type { BenchReport } from '../../src/bench/summarize-bench.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import type { ExportedBundle } from '../../src/export/exported-bundle.ts';
import type { PlayReport } from '../../src/replay/play-replay.ts';
import { SAMPLE_DIR } from '../support/bundles.ts';
import { testImportIo } from '../support/import-io.ts';
import { frame } from '../support/personas.ts';

interface Captured {
  readonly io: CliIo;
  readonly stdout: () => string;
  readonly stderr: () => string;
}

function capture(stdin = new PassThrough(), stdoutStream = new PassThrough()): Captured {
  let out = '';
  let err = '';
  return {
    io: {
      stdout: (text) => (out += text),
      stderr: (text) => (err += text),
      openBundle: openBundleDir,
      writeFiles: writeOutputFiles,
      openReplay: openReplayFile,
      importIo: testImportIo(),
      scanSource: fsScanSource,
      engineIo: {
        loadPersona,
        createReplayWriter: createReplayFileWriter,
        openStdioChannel: () => createStreamLineChannel(stdin, stdoutStream),
        now: () => new Date('2026-10-09T00:00:00.000Z'),
      },
    },
    stdout: () => out,
    stderr: () => err,
  };
}

async function withTempDir(body: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'cm-autoplay-cli-'));
  try {
    await body(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('guide export writes bundle.json, masked-free by default', async () => {
  await withTempDir(async (directory) => {
    const run = capture();
    assert.equal(await runCli(['export', SAMPLE_DIR, '--out', directory], run.io), 0);
    const text = await readFile(join(directory, 'bundle.json'), 'utf8');
    assert.doesNotMatch(text, /"masked"/);
    const exported = JSON.parse(text) as ExportedBundle;
    assert.deepEqual([exported.knowledge, exported.target, exported.game_id], ['player', 'runtime', 'bestia']);
    const full = capture();
    assert.equal(await runCli(['export', SAMPLE_DIR, '--out', join(directory, 'full'), '--knowledge', 'full'], full.io), 0);
    assert.match(await readFile(join(directory, 'full', 'bundle.json'), 'utf8'), /"masked"/);
    assert.equal(await runCli(['export', SAMPLE_DIR, '--out', directory, '--target', 'ingame'], capture().io), 2);
  });
});

test('a recorded sim run replays identically through the utility-bt decider', async () => {
  await withTempDir(async (directory) => {
    const record = join(directory, 'run.jsonl');
    const run = capture();
    const argv = ['run', '--game', SAMPLE_DIR, '--persona', 'novice', '--seed', '9', '--ticks', '400', '--record', record];
    assert.equal(await runCli(argv, run.io), 0);
    const report = JSON.parse(run.stdout()) as { run_id: string; ticks: number; result: string };
    assert.equal(report.run_id, 'run:bestia-novice-s9');
    assert.ok(report.ticks > 0);
    const play = capture();
    assert.equal(await runCli(['replay', 'play', record, '--decider', 'utility-bt', '--game', SAMPLE_DIR, '--json'], play.io), 0, play.stderr());
    const played = JSON.parse(play.stdout()) as PlayReport;
    assert.deepEqual([played.ok, played.ticks_checked], [true, report.ticks]);
    // Another persona judges differently, so the recording no longer follows.
    const other = capture();
    assert.equal(await runCli(['replay', 'play', record, '--decider', 'utility-bt', '--game', SAMPLE_DIR, '--persona', 'explorer'], other.io), 1);
    assert.match(other.stdout(), /MISMATCH/);
    // The recording file is never reused.
    await assert.rejects(runCli(argv, capture().io), /EEXIST/);
  });
});

test('replay play --decider utility-bt needs --game', async () => {
  const run = capture();
  assert.equal(await runCli(['replay', 'play', 'x.jsonl', '--decider', 'utility-bt'], run.io), 2);
  assert.match(run.stderr(), /needs --game/);
  assert.equal(await runCli(['replay', 'play', 'x.jsonl', '--game', SAMPLE_DIR], capture().io), 2);
});

test('guide run --adapter stdio speaks the protocol on the engine\'s stdout and reports on stderr', async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  let sent = '';
  stdout.on('data', (chunk: Buffer) => (sent += chunk.toString('utf8')));
  stdin.end(
    [
      { type: 'hello', protocol: 1, game_id: 'bestia', adapter_id: 'bestia-api', mode: 'player' },
      { type: 'observation', frame: frame({ tick: 0 }) },
      { type: 'bye', result: 'fail', summary: {} },
    ]
      .map((line) => `${JSON.stringify(line)}\n`)
      .join(''),
  );
  const run = capture(stdin, stdout);
  assert.equal(await runCli(['run', '--game', SAMPLE_DIR, '--adapter', 'stdio'], run.io), 0);
  assert.equal(run.stdout(), '');
  assert.match(run.stderr(), /"result": "fail"/);
  assert.equal(sent.trim().split('\n').length, 1);
  assert.equal((JSON.parse(sent) as { type: string }).type, 'action');
});

test('guide bench prints the JSON report', async () => {
  const run = capture();
  assert.equal(await runCli(['bench', '--game', SAMPLE_DIR, '--runs', '2', '--persona', 'expert', '--seed', '4'], run.io), 0);
  const report = JSON.parse(run.stdout()) as BenchReport;
  assert.deepEqual([report.runs, report.persona, report.tactics], [2, 'expert', 'guide']);
  const none = capture();
  assert.equal(await runCli(['bench', '--game', SAMPLE_DIR, '--runs', '1', '--no-tactics'], none.io), 0);
  assert.equal((JSON.parse(none.stdout()) as BenchReport).tactics, 'none');
  assert.equal(await runCli(['bench', '--runs', '1'], capture().io), 2);
  assert.equal(await runCli(['run', '--game', SAMPLE_DIR, '--adapter', 'tcp'], capture().io), 2);
});

test('an unknown persona is an error', async () => {
  await assert.rejects(runCli(['run', '--game', SAMPLE_DIR, '--persona', 'grandmaster'], capture().io), /grandmaster/);
});
