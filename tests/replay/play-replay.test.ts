import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDecider, DECIDER_IDS, DEFAULT_DECIDER_ID, isDeciderId } from '../../src/replay/decider-registry.ts';
import { playReplay } from '../../src/replay/play-replay.ts';
import { createRecordedDecider } from '../../src/replay/recorded-decider.ts';
import { createWaitDecider } from '../../src/replay/wait-decider.ts';
import { loadSample } from '../support/bundles.ts';
import { shippedPersona } from '../support/personas.ts';
import { BASE_RUN, BRANCH_RUN, loadRun } from './replay-fixtures.ts';

test('the recorded decider reproduces every fixture tick by tick', async () => {
  for (const path of [BASE_RUN, BRANCH_RUN]) {
    const run = await loadRun(path);
    const report = playReplay(run, createRecordedDecider(run));
    assert.deepEqual(report, { run_id: run.header.run_id, decider: 'recorded', until: null, ticks_checked: 10, ok: true, first_mismatch: null });
  }
});

test('--until limits the ticks checked', async () => {
  const run = await loadRun(BASE_RUN);
  const report = playReplay(run, createRecordedDecider(run), { until: 3 });
  assert.equal(report.ticks_checked, 4);
  assert.equal(report.until, 3);
  assert.equal(report.ok, true);
});

test('the first mismatching tick is reported and play stops there', async () => {
  const run = await loadRun(BASE_RUN);
  const report = playReplay(run, createWaitDecider());
  assert.equal(report.ok, false);
  assert.equal(report.ticks_checked, 1);
  assert.deepEqual(report.first_mismatch, { tick: 0, recorded: { move_to: 'node:center' }, replayed: { wait: 0 } });
});

test('a decider answering for another run diverges at that run\'s branch tick', async () => {
  const base = await loadRun(BASE_RUN);
  const branch = await loadRun(BRANCH_RUN);
  const report = playReplay(branch, createRecordedDecider(base));
  assert.equal(report.first_mismatch?.tick, 5);
  assert.deepEqual(report.first_mismatch?.recorded, { move_to: 'node:outer-ring' });
  assert.deepEqual(report.first_mismatch?.replayed, { attack: 2 });
  assert.equal(playReplay(branch, createRecordedDecider(base), { until: 4 }).ok, true);
});

test('the registry knows recorded (default), wait and the utility-bt engine', async () => {
  const run = await loadRun(BASE_RUN);
  assert.deepEqual([...DECIDER_IDS], ['recorded', 'wait', 'utility-bt']);
  assert.equal(DEFAULT_DECIDER_ID, 'recorded');
  assert.equal(isDeciderId('utility'), false);
  for (const id of ['recorded', 'wait'] as const) assert.equal(createDecider(id, run).id, id);
  assert.throws(() => createDecider('utility-bt', run), /needs the bundle and a persona/);
  const engine = { bundle: (await loadSample()).bundle, persona: await shippedPersona('expert') };
  assert.equal(createDecider('utility-bt', run, engine).id, 'utility-bt');
});
