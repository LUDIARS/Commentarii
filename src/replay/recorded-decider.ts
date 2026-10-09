// Fixed decider that answers each observation with what the run recorded for that tick.
// Replaying a run through it checks the recording itself (play must match by construction),
// and it stands in for the engine until stage 3 registers the Utility / BT decider.

import type { Decider } from './decider.ts';
import type { ReplayRun } from './replay-record.ts';

export const RECORDED_DECIDER_ID = 'recorded';

export function createRecordedDecider(run: ReplayRun): Decider {
  const byTick = new Map(run.ticks.map((tick) => [tick.tick, tick]));
  return {
    id: RECORDED_DECIDER_ID,
    decide(observation) {
      const recorded = byTick.get(observation.tick);
      if (recorded === undefined) throw new Error(`run ${run.header.run_id} has no tick ${observation.tick}`);
      return { decision: recorded.decision, action: recorded.action };
    },
  };
}
