import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Decider } from '../../src/replay/decider.ts';
import { playReplay } from '../../src/replay/play-replay.ts';
import { RecordingError } from '../../src/replay/recording-error.ts';
import { openRecording } from '../../src/replay/recording-sink.ts';
import { createWaitDecider } from '../../src/replay/wait-decider.ts';
import type { ObservationFrame } from '../../src/replay/observation-frame.ts';
import type { ReplayAction } from '../../src/replay/replay-action.ts';
import { headerFields, memoryWriter, observation, parseText } from './replay-fixtures.ts';

const FIXED_NOW = (): Date => new Date('2026-10-09T00:00:01.000Z');

/** Attacks the spider while it is closer than 18 m, otherwise approaches (deterministic). */
const approachDecider: Decider = {
  id: 'test-approach',
  decide(frame: ObservationFrame) {
    const z = frame.self.pos?.[2] ?? 0;
    const attack = z < 18;
    return {
      decision: [
        { candidate: 'generic:attack-nearest', utility: attack ? 0.7 : 0.2, chosen: attack },
        { candidate: 'generic:approach-target', utility: attack ? 0.3 : 0.6, chosen: !attack },
      ],
      action: attack ? { attack: 2 } : { move_to: 'node:center' },
    };
  },
};

test('records header, one line per tick and the footer; the file loads and plays back identically', async () => {
  const writer = memoryWriter();
  const sink = await openRecording({ header: headerFields(), decider: approachDecider, writer, now: FIXED_NOW });
  const actions: ReplayAction[] = [];
  for (let tick = 0; tick < 5; tick += 1) actions.push(await sink.step(observation(tick)));
  await sink.finish({ result: 'success', summary: { ticks: 5 } });

  assert.equal(writer.lines.length, 7);
  assert.deepEqual(actions[0], { move_to: 'node:center' });
  assert.deepEqual(actions[4], { attack: 2 });
  const loaded = await parseText(writer.text());
  assert.deepEqual(loaded.issues, []);
  assert.ok(loaded.run);
  assert.equal(loaded.run.footer.ended_at, '2026-10-09T00:00:01.000Z');
  assert.deepEqual(loaded.run.ticks.map((tick) => tick.action), actions);

  const report = playReplay(loaded.run, approachDecider);
  assert.equal(report.ok, true);
  assert.equal(report.ticks_checked, 5);
});

test('player mode: a masked observation is refused before the decider sees it and nothing is written', async () => {
  const writer = memoryWriter();
  let decided = 0;
  const counting: Decider = {
    id: 'counting',
    decide: () => {
      decided += 1;
      return { decision: [], action: { wait: 0 } };
    },
  };
  const sink = await openRecording({ header: headerFields(), decider: counting, writer, now: FIXED_NOW });
  const masked: ObservationFrame = { ...observation(0), self: { hp: { value: 0.4, knowledge: 'masked' } } };

  await assert.rejects(sink.step(masked), (error: unknown) => {
    assert.ok(error instanceof RecordingError);
    assert.equal(error.isMaskedInPlayer, true);
    assert.deepEqual(error.problems.map((problem) => problem.pointer), ['/observation/self/hp']);
    return true;
  });
  assert.equal(decided, 0);
  assert.equal(writer.lines.length, 1);
});

test('player mode: a masked value in the decider output is refused', async () => {
  const leaking: Decider = { id: 'leaking', decide: () => ({ decision: [], action: { custom: 'peek', params: { drop: { value: 0.1, knowledge: 'masked' } } } }) };
  const sink = await openRecording({ header: headerFields(), decider: leaking, writer: memoryWriter(), now: FIXED_NOW });
  await assert.rejects(sink.step(observation(0)), (error: unknown) => error instanceof RecordingError && error.isMaskedInPlayer);
});

test('player mode: a masked value in the footer summary is refused', async () => {
  const sink = await openRecording({ header: headerFields(), decider: createWaitDecider(), writer: memoryWriter(), now: FIXED_NOW });
  await assert.rejects(sink.finish({ result: 'abort', summary: { seed_table: { value: [1, 2], knowledge: 'masked' } } }), (error: unknown) => error instanceof RecordingError && error.isMaskedInPlayer);
});

test('omniscient mode records masked values', async () => {
  const writer = memoryWriter();
  const sink = await openRecording({ header: headerFields('omniscient'), decider: createWaitDecider(), writer, now: FIXED_NOW });
  await sink.step({ ...observation(0, 'omniscient'), self: { hp: { value: 0.4, knowledge: 'masked' } } });
  await sink.finish({ result: 'success' });
  const loaded = await parseText(writer.text());
  assert.deepEqual(loaded.issues, []);
});

test('refuses ticks that do not increase, frames of another mode, and steps after finish', async () => {
  const sink = await openRecording({ header: headerFields(), decider: createWaitDecider(), writer: memoryWriter(), now: FIXED_NOW });
  await sink.step(observation(3));
  await assert.rejects(sink.step(observation(3)), (error: unknown) => error instanceof RecordingError && error.problems.some((problem) => problem.code === 'tick-order'));
  await assert.rejects(sink.step(observation(4, 'omniscient')), (error: unknown) => error instanceof RecordingError && error.problems.some((problem) => problem.code === 'mode-mismatch'));
  await sink.finish({ result: 'abort' });
  await assert.rejects(sink.step(observation(5)), /already finished/);
  await assert.rejects(sink.finish({ result: 'abort' }), /already finished/);
});
