// Game adapter contract (design 7.3), the TypeScript side of the boundary between the engine
// and a game. An adapter only observes and acts; the tick loop lives in the engine's driver
// (src/engine/driver.ts). The same contract runs over a process boundary as JSON Lines
// (spec/feature/adapter-protocol.md, adapter/cpp/commentarii_adapter.hpp).
//
// Responsibilities the adapter owes the engine:
//   - observations follow schema/observation-frame.schema.json, ticks strictly increasing;
//   - in `player` mode it never puts a masked value into an observation (principle 2). The
//     driver checks this again and stops the run if one slips through.

import type { ObservationFrame, ObservationMode } from '../replay/observation-frame.ts';
import type { ReplayAction } from '../replay/replay-action.ts';
import type { ReplayResult } from '../replay/replay-record.ts';

/** First thing an adapter tells the engine (the `hello` line of the protocol). */
export interface AdapterHello {
  readonly game_id: string;
  readonly adapter_id: string;
  /** The mode the adapter is filtering for; must equal the mode the engine asked for. */
  readonly mode: ObservationMode;
}

/** The game ended on its own (the `bye` line from the game). */
export interface AdapterEnd {
  readonly result: ReplayResult;
  readonly summary: Readonly<Record<string, unknown>>;
}

export type Observed = { readonly type: 'observation'; readonly frame: ObservationFrame } | { readonly type: 'end'; readonly end: AdapterEnd };

/** Why the engine side ended a run (sent to the game as the engine's `bye`). */
export type EngineStopReason = 'game-ended' | 'tick-limit' | 'masked-in-player' | 'mode-mismatch' | 'error';

export interface GameAdapter {
  hello(): Promise<AdapterHello>;
  /** The next tick's observation, or the end of the game. */
  observe(): Promise<Observed>;
  /** Performs the action for the tick just observed. */
  act(action: ReplayAction): Promise<void>;
  /** Game-side entity key -> guide entity ID (the mapping of the master import), if known. */
  identify(gameEntity: string): string | undefined;
  /** Ends the session (always called once by the driver, whatever ended the run). */
  close(reason: EngineStopReason): Promise<void>;
}
