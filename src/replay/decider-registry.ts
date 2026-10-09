// Decider ids accepted by `guide replay play --decider <id>`: the two fixed deciders of stage
// 2A and the stage 3 engine (utility-bt), which also needs the bundle and the persona.

import { createUtilityBtDecider, UTILITY_BT_DECIDER_ID, type EngineSetup } from '../engine/utility-bt-decider.ts';
import type { Decider } from './decider.ts';
import { createRecordedDecider, RECORDED_DECIDER_ID } from './recorded-decider.ts';
import type { ReplayRun } from './replay-record.ts';
import { createWaitDecider, WAIT_DECIDER_ID } from './wait-decider.ts';

export const DECIDER_IDS = [RECORDED_DECIDER_ID, WAIT_DECIDER_ID, UTILITY_BT_DECIDER_ID] as const;

export type DeciderId = (typeof DECIDER_IDS)[number];

/** Used when play is given no --decider. */
export const DEFAULT_DECIDER_ID: DeciderId = RECORDED_DECIDER_ID;

export function isDeciderId(value: string): value is DeciderId {
  return (DECIDER_IDS as readonly string[]).includes(value);
}

/** Whether the decider judges from the guide (and so needs --game and a persona). */
export function needsEngineSetup(id: DeciderId): boolean {
  return id === UTILITY_BT_DECIDER_ID;
}

/**
 * A fresh decider for one play of `run` (deciders may keep per-run state). The engine replays
 * with the run's own seed, so a run it recorded is reproduced tick by tick.
 */
export function createDecider(id: DeciderId, run: ReplayRun, engine?: EngineSetup): Decider {
  switch (id) {
    case RECORDED_DECIDER_ID:
      return createRecordedDecider(run);
    case WAIT_DECIDER_ID:
      return createWaitDecider();
    case UTILITY_BT_DECIDER_ID:
      if (engine === undefined) throw new Error('the utility-bt decider needs the bundle and a persona (--game)');
      return createUtilityBtDecider(engine, run.header.seed);
  }
}
