// GameAdapter over the JSON Lines protocol (src/adapter/protocol.ts): the game runs in its own
// process and talks to `guide run --adapter stdio` through the engine's stdin / stdout. The
// adapter answers every observation with exactly one action and says bye when the engine
// stops. Identities announced in hello back identify().

import type { AdapterHello, GameAdapter, Observed } from '../../adapter/game-adapter.ts';
import { parseGameMessage, ProtocolError, serializeEngineMessage } from '../../adapter/protocol.ts';
import type { LineChannel } from './line-channel.ts';

export function createStdioAdapter(channel: LineChannel): GameAdapter {
  let identities: Readonly<Record<string, string>> = {};
  let lastTick: number | undefined;
  let ended = false;
  let closed = false;

  const nextMessage = async (): Promise<ReturnType<typeof parseGameMessage> | undefined> => {
    for (;;) {
      const line = await channel.readLine();
      if (line === undefined) return undefined;
      if (line.trim() !== '') return parseGameMessage(line);
    }
  };

  return {
    async hello(): Promise<AdapterHello> {
      const message = await nextMessage();
      if (message?.type !== 'hello') throw new ProtocolError(`expected hello, got ${message === undefined ? 'end of input' : message.type}`);
      identities = message.identities ?? {};
      return { game_id: message.game_id, adapter_id: message.adapter_id, mode: message.mode };
    },
    async observe(): Promise<Observed> {
      const message = await nextMessage();
      if (message === undefined) {
        // The game closed the channel without bye: the run did not end cleanly.
        ended = true;
        return { type: 'end', end: { result: 'abort', summary: { stopped: 'game-closed-channel' } } };
      }
      if (message.type === 'bye') {
        ended = true;
        return { type: 'end', end: { result: message.result, summary: message.summary ?? {} } };
      }
      if (message.type !== 'observation') throw new ProtocolError(`expected observation or bye, got ${message.type}`);
      lastTick = message.frame.tick;
      return { type: 'observation', frame: message.frame };
    },
    async act(action) {
      if (lastTick === undefined) throw new ProtocolError('act() before any observation');
      await channel.writeLine(serializeEngineMessage({ type: 'action', tick: lastTick, action }));
    },
    identify(gameEntity) {
      return Object.hasOwn(identities, gameEntity) ? identities[gameEntity] : undefined;
    },
    async close(reason) {
      if (closed) return;
      closed = true;
      try {
        if (!ended) await channel.writeLine(serializeEngineMessage({ type: 'bye', reason }));
      } finally {
        channel.close();
      }
    },
  };
}
