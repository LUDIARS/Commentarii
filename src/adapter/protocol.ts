// JSON Lines protocol of a process-separated adapter (spec/feature/adapter-protocol.md):
//   game -> engine   hello, observation (one per tick), bye
//   engine -> game   action (one per observation), bye
// One UTF-8 JSON object per LF-terminated line, nothing else on the channel.

import { isJsonObject } from '../domain/value-node.ts';
import type { ObservationFrame } from '../replay/observation-frame.ts';
import type { ReplayAction } from '../replay/replay-action.ts';
import type { ReplayResult } from '../replay/replay-record.ts';
import type { AdapterHello, EngineStopReason } from './game-adapter.ts';

export const PROTOCOL_VERSION = 1;

export type GameMessage =
  | ({ readonly type: 'hello'; readonly protocol: number; readonly identities?: Readonly<Record<string, string>> } & AdapterHello)
  | { readonly type: 'observation'; readonly frame: ObservationFrame }
  | { readonly type: 'bye'; readonly result: ReplayResult; readonly summary?: Readonly<Record<string, unknown>> };

export type EngineMessage =
  | { readonly type: 'action'; readonly tick: number; readonly action: ReplayAction }
  | { readonly type: 'bye'; readonly reason: EngineStopReason };

export class ProtocolError extends Error {
  override readonly name = 'ProtocolError';
}

const MODES = new Set(['player', 'omniscient']);
const PURPOSES = new Set(['efficiency', 'coverage']);
const RESULTS = new Set(['success', 'fail', 'abort']);

function isStringRecord(value: unknown): value is Record<string, string> {
  return isJsonObject(value) && Object.values(value).every((item) => typeof item === 'string');
}

/** The structural minimum the engine relies on; the recorder and replay loader check the rest. */
function checkFrame(frame: unknown): ObservationFrame {
  if (!isJsonObject(frame)) throw new ProtocolError('observation.frame must be an object');
  const { tick, t, mode, purpose, self, entities, stage, events } = frame;
  if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0) throw new ProtocolError('frame.tick must be a non-negative integer');
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) throw new ProtocolError('frame.t must be a non-negative number');
  if (typeof mode !== 'string' || !MODES.has(mode)) throw new ProtocolError('frame.mode must be player or omniscient');
  if (typeof purpose !== 'string' || !PURPOSES.has(purpose)) throw new ProtocolError('frame.purpose must be efficiency or coverage');
  if (!isJsonObject(self)) throw new ProtocolError('frame.self must be an object');
  if (!Array.isArray(entities) || !entities.every((entity) => isJsonObject(entity) && Number.isInteger(entity.instance))) {
    throw new ProtocolError('frame.entities must be objects with an integer instance');
  }
  if (!isJsonObject(stage) || typeof stage.id !== 'string') throw new ProtocolError('frame.stage.id must be a string');
  if (!Array.isArray(events) || !events.every((event) => isJsonObject(event) && typeof event.kind === 'string')) {
    throw new ProtocolError('frame.events must be objects with a kind');
  }
  return frame as unknown as ObservationFrame;
}

export function parseGameMessage(line: string): GameMessage {
  let data: unknown;
  try {
    data = JSON.parse(line);
  } catch (cause) {
    throw new ProtocolError(`not a JSON line: ${(cause as Error).message}`);
  }
  if (!isJsonObject(data)) throw new ProtocolError('a protocol line must be a JSON object');
  switch (data.type) {
    case 'hello': {
      const { protocol, game_id: gameId, adapter_id: adapterId, mode, identities } = data;
      if (protocol !== PROTOCOL_VERSION) throw new ProtocolError(`unsupported protocol ${String(protocol)} (expected ${PROTOCOL_VERSION})`);
      if (typeof gameId !== 'string' || typeof adapterId !== 'string') throw new ProtocolError('hello needs game_id and adapter_id');
      if (typeof mode !== 'string' || !MODES.has(mode)) throw new ProtocolError('hello.mode must be player or omniscient');
      if (identities !== undefined && !isStringRecord(identities)) throw new ProtocolError('hello.identities must map strings to entity IDs');
      return {
        type: 'hello',
        protocol,
        game_id: gameId,
        adapter_id: adapterId,
        mode: mode as AdapterHello['mode'],
        ...(identities === undefined ? {} : { identities }),
      };
    }
    case 'observation':
      return { type: 'observation', frame: checkFrame(data.frame) };
    case 'bye': {
      if (typeof data.result !== 'string' || !RESULTS.has(data.result)) throw new ProtocolError('bye.result must be success, fail or abort');
      if (data.summary !== undefined && !isJsonObject(data.summary)) throw new ProtocolError('bye.summary must be an object');
      return { type: 'bye', result: data.result as ReplayResult, ...(data.summary === undefined ? {} : { summary: data.summary }) };
    }
    default:
      throw new ProtocolError(`unknown message type ${JSON.stringify(data.type)}`);
  }
}

export function serializeEngineMessage(message: EngineMessage): string {
  // JSON.stringify escapes newlines inside strings, so a message is always exactly one line.
  return JSON.stringify(message);
}
