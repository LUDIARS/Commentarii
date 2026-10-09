import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReplayFileWriter } from '../../src/adapters/fs/replay-file-writer.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { playReplay } from '../../src/replay/play-replay.ts';
import { createRecordedDecider } from '../../src/replay/recorded-decider.ts';
import { openRecording } from '../../src/replay/recording-sink.ts';
import { replayRelativePath } from '../../src/replay/replay-path.ts';
import { createWaitDecider } from '../../src/replay/wait-decider.ts';
import { headerFields, observation } from './replay-fixtures.ts';

test('replay/<run-id>.jsonl drops the run: prefix', () => {
  assert.equal(replayRelativePath('run:bestia-dome-001'), 'replay/bestia-dome-001.jsonl');
  assert.throws(() => replayRelativePath('bestia-dome-001'), /not a run id/);
  assert.throws(() => replayRelativePath('run:../escape'), /not a run id/);
});

test('record to a file, reopen it, and play it back with the wait decider and the recorded decider', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cm-replay-file-'));
  try {
    const header = headerFields();
    const path = join(directory, ...replayRelativePath(header.run_id).split('/'));
    const sink = await openRecording({ header, decider: createWaitDecider(), writer: await createReplayFileWriter(path), now: () => new Date('2026-10-09T00:00:02.000Z') });
    for (let tick = 0; tick < 4; tick += 1) await sink.step(observation(tick));
    await sink.finish({ result: 'abort', summary: { ticks: 4 } });

    const text = await readFile(path, 'utf8');
    assert.equal(text.split('\n').length, 7);
    assert.ok(text.endsWith('}\n'));
    assert.ok(!text.includes('\r'));

    const loaded = await openReplayFile(path);
    assert.deepEqual(loaded.issues, []);
    assert.ok(loaded.run);
    assert.equal(playReplay(loaded.run, createWaitDecider()).ok, true);
    assert.equal(playReplay(loaded.run, createRecordedDecider(loaded.run)).ok, true);

    await assert.rejects(createReplayFileWriter(path), /EEXIST/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
