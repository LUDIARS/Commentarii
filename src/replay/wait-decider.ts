// Fixed decider that always waits one tick and weighs nothing. The weakest possible engine:
// a baseline for play / diff and for recorder tests that need a decider with no judgement.

import type { Decider } from './decider.ts';

export const WAIT_DECIDER_ID = 'wait';

export function createWaitDecider(): Decider {
  return {
    id: WAIT_DECIDER_ID,
    decide: () => ({ decision: [], action: { wait: 0 } }),
  };
}
