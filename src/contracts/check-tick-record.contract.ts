// C-9 checkTickRecord(header, previous, record): masked anywhere in a player tick line is always
// reported as masked-in-player; omniscient lines never are.

import type { ReplayHeader, ReplayTick } from '../replay/replay-record.ts';
import type { TickProblem } from '../replay/tick-invariants.ts';

function containsMasked(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsMasked);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.knowledge === 'masked') return true;
  return Object.values(record).some(containsMasked);
}

export default {
  post: (problems: TickProblem[], header: ReplayHeader, _previous: ReplayTick | undefined, record: ReplayTick) => {
    const reportsMasked = problems.some((problem) => problem.code === 'masked-in-player');
    if (header.mode === 'omniscient') return !reportsMasked || 'omniscient line reported as masked-in-player';
    if (containsMasked(record)) return reportsMasked || 'masked value in a player line is not reported';
    return !reportsMasked || 'masked-in-player reported without a masked value';
  },
};
