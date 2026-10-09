import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
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
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import { createFsLearnIo } from '../../src/learn/io/fs-learn-io.ts';
import { parseRunObservations } from '../../src/learn/observations/run-observations.ts';
import type { Overlay } from '../../src/learn/overlay/overlay.ts';
import { findMaskedPointers } from '../../src/replay/find-masked-pointers.ts';
import { schemaRegistry } from '../support/bundles.ts';
import { testImportIo } from '../support/import-io.ts';
import { CLOSE, runPath, withDriftedCopy } from '../support/learn.ts';

function capture(): { io: CliIo; stdout: () => string; stderr: () => string } {
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
        openStdioChannel: () => createStreamLineChannel(new PassThrough(), new PassThrough()),
        now: () => new Date('2026-10-09T00:00:00.000Z'),
      },
      learnIo: createFsLearnIo(),
    },
    stdout: () => out,
    stderr: () => err,
  };
}

/** Text of every canonical file (overlay and run files excluded). */
async function canonicalTexts(directory: string): Promise<Map<string, string>> {
  const names = (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1).replaceAll('\\', '/'))
    .filter((path) => !path.startsWith('observations/'))
    .sort();
  return new Map(await Promise.all(names.map(async (path) => [path, await readFile(join(directory, path), 'utf8')] as const)));
}

test('learn ingest writes only the overlay; consolidate changes nothing without --apply', async () => {
  await withDriftedCopy(async (directory) => {
    const before = await canonicalTexts(directory);
    const ingest = capture();
    assert.equal(await runCli(['learn', 'ingest', '--game', directory, runPath('drift-a'), runPath('drift-b'), runPath('omni-a')], ingest.io), 0, ingest.stderr());
    assert.match(ingest.stdout(), /## 値のずれ/);
    assert.match(ingest.stdout(), /無視した omniscient run: 1/);
    const overlay = JSON.parse(await readFile(join(directory, 'observations', 'overlay.json'), 'utf8')) as Overlay;
    assert.deepEqual(overlay.runs, { player: ['run:drift-a', 'run:drift-b'], ignored_omniscient: ['run:omni-a'] });
    assert.deepEqual(await canonicalTexts(directory), before, 'ingest leaves the canonical bundle as it was');

    const dry = capture();
    assert.equal(await runCli(['learn', 'consolidate', '--game', directory], dry.io), 0, dry.stderr());
    assert.match(dry.stdout(), /承認待ち/);
    assert.deepEqual(await canonicalTexts(directory), before);

    const apply = capture();
    assert.equal(await runCli(['learn', 'consolidate', '--game', directory, '--apply', '--json'], apply.io), 0, apply.stderr());
    const report = JSON.parse(apply.stdout()) as { applied: string[]; written: string[] };
    assert.deepEqual(report.applied, [`rewrite:${CLOSE}`]);
    const after = await canonicalTexts(directory);
    const kept = JSON.parse(after.get('tactics/close-in-dragonfly.json') ?? '{}') as { superseded_by: string };
    assert.equal(kept.superseded_by, `${CLOSE}--substitute`);
    assert.ok(after.has('tactics/close-in-dragonfly--substitute.json'));
    assert.equal(after.get('tactics/kite-wire-spider.json'), before.get('tactics/kite-wire-spider.json'), 'the taught tactic is not rewritten');
    const validate = capture();
    assert.equal(await runCli(['validate', directory], validate.io), 0, validate.stdout());
  });
});

test('guide run --observe reflects a player run into a masked-free file guide learn ingest reads', async () => {
  await withDriftedCopy(async (directory) => {
    const path = join(directory, 'observations', 'runs', 'sim-expert-s3.jsonl');
    const run = capture();
    assert.equal(await runCli(['run', '--game', directory, '--seed', '3', '--ticks', '400', '--observe', path], run.io), 0, run.stderr());
    const text = await readFile(path, 'utf8');
    const observations = parseRunObservations(path, text, await schemaRegistry());
    assert.equal(observations.mode, 'player');
    assert.ok(observations.lines.length > 0);
    assert.deepEqual(findMaskedPointers(observations.lines), []);
    const ingest = capture();
    assert.equal(await runCli(['learn', 'ingest', '--game', directory, path, '--json'], ingest.io), 0, ingest.stderr());
    assert.deepEqual((JSON.parse(ingest.stdout()) as { runs: { ingested: string[] } }).runs.ingested, ['run:sim-expert-s3']);
  });
});

test('learn reports bad inputs: missing runs, unknown verbs, no overlay to consolidate', async () => {
  await withDriftedCopy(async (directory) => {
    assert.equal(await runCli(['learn', 'ingest', '--game', directory], capture().io), 2);
    assert.equal(await runCli(['learn', 'teach', '--game', directory], capture().io), 2);
    const missing = capture();
    assert.equal(await runCli(['learn', 'ingest', '--game', directory, join(directory, 'nope.jsonl')], missing.io), 1);
    assert.match(missing.stderr(), /does not exist/);
    const empty = capture();
    assert.equal(await runCli(['learn', 'consolidate', '--game', directory], empty.io), 1);
    assert.match(empty.stderr(), /run guide learn ingest first/);
  });
});
