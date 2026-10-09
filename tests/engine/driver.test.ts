import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameAdapter, Observed } from '../../src/adapter/game-adapter.ts';
import { runDriver } from '../../src/engine/driver.ts';
import type { ObservationFrame, ObservationMode } from '../../src/replay/observation-frame.ts';
import type { ReplayAction } from '../../src/replay/replay-action.ts';
import { createWaitDecider } from '../../src/replay/wait-decider.ts';
import { memoryWriter } from '../replay/replay-fixtures.ts';
import { frame } from '../support/personas.ts';

interface ScriptedAdapter extends GameAdapter {
  readonly acted: ReplayAction[];
  readonly closedWith: string[];
}

/** Plays the given frames, then ends the game (unless `endless`). */
function scripted(frames: readonly ObservationFrame[], mode: ObservationMode = 'player', endless = false): ScriptedAdapter {
  const acted: ReplayAction[] = [];
  const closedWith: string[] = [];
  let next = 0;
  return {
    acted,
    closedWith,
    hello: async () => ({ game_id: 'bestia', adapter_id: 'scripted', mode }),
    async observe(): Promise<Observed> {
      const current = frames[next];
      if (current === undefined) {
        return endless ? { type: 'observation', frame: frame({ tick: next++ }) } : { type: 'end', end: { result: 'success', summary: { cleared: true } } };
      }
      next += 1;
      return { type: 'observation', frame: current };
    },
    act: async (action) => {
      acted.push(action);
    },
    identify: () => undefined,
    close: async (reason) => {
      closedWith.push(reason);
    },
  };
}

function leaky(tick: number): ObservationFrame {
  const base = frame({ tick });
  return { ...base, self: { ...base.self, hp: { value: 0.7, knowledge: 'masked' } } };
}

test('the driver runs until the game ends and reports its result', async () => {
  const adapter = scripted([frame({ tick: 0 }), frame({ tick: 1 })]);
  const report = await runDriver({ adapter, decider: createWaitDecider(), mode: 'player', maxTicks: 10 });
  assert.deepEqual([report.result, report.stop.reason, report.ticks], ['success', 'game-ended', 2]);
  assert.deepEqual(report.summary, { cleared: true });
  assert.equal(adapter.acted.length, 2);
  assert.deepEqual(adapter.closedWith, ['game-ended']);
});

test('in player mode a masked value in an observation stops the run before the decider sees it', async () => {
  const seen: number[] = [];
  const decider = { id: 'spy', decide: (observation: ObservationFrame) => (seen.push(observation.tick), { decision: [], action: { wait: 0 } }) };
  const adapter = scripted([frame({ tick: 0 }), leaky(1), frame({ tick: 2 })]);
  const writer = memoryWriter();
  const record = { writer, header: { run_id: 'run:leak', seed: 1, manifest_version: '0.1.0', purpose: 'efficiency' as const }, now: () => new Date('2026-10-09T00:00:00Z') };
  const report = await runDriver({ adapter, decider, mode: 'player', maxTicks: 10, record });
  assert.equal(report.result, 'abort');
  assert.deepEqual(report.stop, { reason: 'masked-in-player', tick: 1, pointers: ['/self/hp'] });
  assert.deepEqual(seen, [0]);
  assert.equal(adapter.acted.length, 1);
  assert.deepEqual(adapter.closedWith, ['masked-in-player']);
  assert.doesNotMatch(writer.text(), /"masked"/, 'nothing of the leaking observation is recorded');
  const footer = JSON.parse(writer.lines.at(-1) ?? '{}') as { type: string; result: string; summary: Record<string, unknown> };
  assert.deepEqual([footer.type, footer.result, footer.summary.stopped], ['footer', 'abort', 'masked-in-player']);
});

test('omniscient runs may carry masked values', async () => {
  const report = await runDriver({ adapter: scripted([{ ...leaky(0), mode: 'omniscient' }], 'omniscient'), decider: createWaitDecider(), mode: 'omniscient', maxTicks: 5 });
  assert.equal(report.stop.reason, 'game-ended');
});

test('a mode the adapter does not honour stops the run', async () => {
  const atHello = await runDriver({ adapter: scripted([frame()], 'omniscient'), decider: createWaitDecider(), mode: 'player', maxTicks: 5 });
  assert.deepEqual(atHello.stop, { reason: 'mode-mismatch', expected: 'player', got: 'omniscient' });
  assert.equal(atHello.ticks, 0);
  const inFrame = await runDriver({ adapter: scripted([{ ...frame(), mode: 'omniscient' }]), decider: createWaitDecider(), mode: 'player', maxTicks: 5 });
  assert.equal(inFrame.stop.reason, 'mode-mismatch');
});

test('the tick limit ends an endless game with abort', async () => {
  const report = await runDriver({ adapter: scripted([], 'player', true), decider: createWaitDecider(), mode: 'player', maxTicks: 3 });
  assert.deepEqual([report.result, report.stop.reason, report.ticks], ['abort', 'tick-limit', 3]);
});
