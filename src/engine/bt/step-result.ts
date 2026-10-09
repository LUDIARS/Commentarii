// Outcome of stepping a (sub)tree for one tick. At most one action per tick: `running` always
// carries the action to perform, `success` may (a leaf that acted and finished), `failure`
// never does.

import type { ReplayAction } from '../../replay/replay-action.ts';
import type { BtMemory } from './bt-memory.ts';

export type BtStatus = 'running' | 'success' | 'failure';

export interface StepResult {
  readonly status: BtStatus;
  readonly action?: ReplayAction;
  readonly memory: BtMemory;
}
