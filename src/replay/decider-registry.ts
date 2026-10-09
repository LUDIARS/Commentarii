// Decider ids accepted by `guide replay play --decider <id>`. Stage 3 adds the engine here.

import type { Decider } from './decider.ts';
import { createRecordedDecider, RECORDED_DECIDER_ID } from './recorded-decider.ts';
import type { ReplayRun } from './replay-record.ts';
import { createWaitDecider, WAIT_DECIDER_ID } from './wait-decider.ts';

export const DECIDER_IDS = [RECORDED_DECIDER_ID, WAIT_DECIDER_ID] as const;

export type DeciderId = (typeof DECIDER_IDS)[number];

/** Used when play is given no --decider. */
export const DEFAULT_DECIDER_ID: DeciderId = RECORDED_DECIDER_ID;

export function isDeciderId(value: string): value is DeciderId {
  return (DECIDER_IDS as readonly string[]).includes(value);
}

/** A fresh decider for one play of `run` (deciders may keep per-run state). */
export function createDecider(id: DeciderId, run: ReplayRun): Decider {
  switch (id) {
    case RECORDED_DECIDER_ID:
      return createRecordedDecider(run);
    case WAIT_DECIDER_ID:
      return createWaitDecider();
  }
}
