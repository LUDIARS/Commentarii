import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import type { PlayReport } from '../../src/replay/play-replay.ts';
import type { ReplayDiff } from '../../src/replay/diff-replays.ts';
import { testImportIo } from '../support/import-io.ts';
import { BASE_RUN, BRANCH_RUN, fixtureText } from './replay-fixtures.ts';

interface Captured {
  readonly io: CliIo;
  readonly stdout: () => string;
  readonly stderr: () => string;
}

function capture(): Captured {
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
    },
    stdout: () => out,
    stderr: () => err,
  };
}

test('replay play matches a fixture with the default (recorded) decider', async () => {
  const run = capture();
  assert.equal(await runCli(['replay', 'play', BASE_RUN], run.io), 0);
  assert.match(run.stdout(), /decider=recorded, all ticks/);
  assert.match(run.stdout(), /result: OK \(10 tick\(s\) matched\)/);
});

test('replay play exits 1 and names the first mismatching tick', async () => {
  const run = capture();
  assert.equal(await runCli(['replay', 'play', BASE_RUN, '--decider', 'wait', '--until', '5'], run.io), 1);
  assert.match(run.stdout(), /MISMATCH at tick 0/);
  const json = capture();
  await runCli(['replay', 'play', BASE_RUN, '--decider', 'wait', '--json'], json.io);
  const report = JSON.parse(json.stdout()) as PlayReport;
  assert.equal(report.first_mismatch?.tick, 0);
});

test('replay diff prints Markdown, or JSON with --json', async () => {
  const markdown = capture();
  assert.equal(await runCli(['replay', 'diff', BASE_RUN, BRANCH_RUN], markdown.io), 0);
  assert.match(markdown.stdout(), /^# リプレイ差分/);
  assert.match(markdown.stdout(), /- ティック: 5/);
  const json = capture();
  assert.equal(await runCli(['replay', 'diff', BASE_RUN, BRANCH_RUN, '--json', '--limit', '2'], json.io), 0);
  const diff = JSON.parse(json.stdout()) as ReplayDiff;
  assert.equal(diff.first_divergence?.tick, 5);
  assert.equal(diff.action_diff.count, 3);
  assert.equal(diff.action_diff.shown.length, 2);
});

test('a replay that does not load exits 1 with its issues on stderr', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cm-replay-cli-'));
  try {
    const broken = join(directory, 'broken.jsonl');
    await writeFile(broken, (await fixtureText(BASE_RUN)).split('\n').slice(1).join('\n'), 'utf8');
    for (const argv of [['replay', 'play', broken], ['replay', 'diff', BASE_RUN, broken]]) {
      const run = capture();
      assert.equal(await runCli(argv, run.io), 1, argv.join(' '));
      assert.match(run.stderr(), /not a usable replay/);
      assert.equal(run.stdout(), '');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('replay usage errors exit 2', async () => {
  for (const argv of [
    ['replay'],
    ['replay', 'record', BASE_RUN],
    ['replay', 'play'],
    ['replay', 'play', BASE_RUN, BRANCH_RUN],
    ['replay', 'play', BASE_RUN, '--decider', 'utility'],
    ['replay', 'play', BASE_RUN, '--until', '-1'],
    ['replay', 'diff', BASE_RUN],
    ['replay', 'diff', BASE_RUN, BRANCH_RUN, '--limit', 'x'],
  ]) {
    const run = capture();
    assert.equal(await runCli(argv, run.io), 2, argv.join(' '));
    assert.match(run.stderr(), /guide replay play/);
  }
});
