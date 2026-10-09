import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { parseGameMessage, ProtocolError } from '../../../src/adapter/protocol.ts';
import { createStreamLineChannel } from '../../../src/adapters/stdio/line-channel.ts';
import { createStdioAdapter } from '../../../src/adapters/stdio/stdio-adapter.ts';
import { runDriver } from '../../../src/engine/driver.ts';
import { createWaitDecider } from '../../../src/replay/wait-decider.ts';
import { frame } from '../../support/personas.ts';

function gameLines(lines: readonly unknown[]): string {
  return lines.map((line) => `${typeof line === 'string' ? line : JSON.stringify(line)}\r\n`).join('');
}

async function drive(lines: readonly unknown[], mode: 'player' | 'omniscient' = 'player') {
  const input = new PassThrough();
  const output = new PassThrough();
  let written = '';
  output.on('data', (chunk: Buffer) => (written += chunk.toString('utf8')));
  input.end(gameLines(lines));
  const adapter = createStdioAdapter(createStreamLineChannel(input, output));
  const report = await runDriver({ adapter, decider: createWaitDecider(), mode, maxTicks: 10 });
  return { report, adapter, sent: written.split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as Record<string, unknown>) };
}

const HELLO = { type: 'hello', protocol: 1, game_id: 'bestia', adapter_id: 'bestia-api', mode: 'player', identities: { beetle: 'enemy:bestia:bazooka-beetle' } };

test('hello, one action per observation, and the game\'s bye end the run', async () => {
  const { report, adapter, sent } = await drive([HELLO, { type: 'observation', frame: frame({ tick: 0 }) }, '', { type: 'observation', frame: frame({ tick: 1 }) }, { type: 'bye', result: 'success', summary: { time: 1 } }]);
  assert.deepEqual([report.result, report.ticks], ['success', 2]);
  assert.deepEqual(sent, [
    { type: 'action', tick: 0, action: { wait: 0 } },
    { type: 'action', tick: 1, action: { wait: 0 } },
  ]);
  assert.equal(adapter.identify('beetle'), 'enemy:bestia:bazooka-beetle');
  assert.equal(adapter.identify('spider'), undefined);
});

test('the engine says bye with its reason when it stops first', async () => {
  const leaky = { ...frame({ tick: 0 }), self: { hp: { value: 0.5, knowledge: 'masked' } } };
  const { report, sent } = await drive([HELLO, { type: 'observation', frame: leaky }]);
  assert.equal(report.stop.reason, 'masked-in-player');
  assert.deepEqual(sent, [{ type: 'bye', reason: 'masked-in-player' }]);
});

test('a game that closes the channel without bye aborts the run', async () => {
  const { report, sent } = await drive([HELLO, { type: 'observation', frame: frame({ tick: 0 }) }]);
  assert.deepEqual([report.result, report.summary], ['abort', { stopped: 'game-closed-channel' }]);
  assert.equal(sent.length, 1);
});

test('malformed protocol lines are protocol errors', async () => {
  assert.throws(() => parseGameMessage('nope'), ProtocolError);
  assert.throws(() => parseGameMessage(JSON.stringify({ ...HELLO, protocol: 2 })), /unsupported protocol/);
  assert.throws(() => parseGameMessage(JSON.stringify({ type: 'observation', frame: { tick: -1 } })), /tick/);
  assert.throws(() => parseGameMessage(JSON.stringify({ type: 'bye', result: 'won' })), /bye.result/);
  assert.throws(() => parseGameMessage(JSON.stringify({ type: 'teleport' })), /unknown message type/);
  await assert.rejects(drive([{ type: 'observation', frame: frame() }]), /expected hello/);
});
