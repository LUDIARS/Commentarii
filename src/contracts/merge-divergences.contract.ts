// C-51 mergeDivergences(store, gameId, found): every stored entry is kept with its human fields
// (decision, decided_by, note) unchanged and its runs kept; every found divergence is in the
// result; a new entry starts pending; IDs are unique; the list is ordered pending, allow, reject.

import type { DivergenceStore } from '../verify/intent/divergence-store.ts';
import type { Divergence } from '../verify/intent/divergence.ts';

const ORDER = { pending: 0, allow: 1, reject: 2 } as const;

export default {
  post: (result: DivergenceStore, store: DivergenceStore | undefined, _gameId: string, found: readonly Divergence[]) => {
    const byId = new Map(result.divergences.map((entry) => [entry.id, entry]));
    if (byId.size !== result.divergences.length) return 'duplicate divergence IDs';
    for (const before of store?.divergences ?? []) {
      const after = byId.get(before.id);
      if (after === undefined) return `${before.id} was dropped`;
      if (after.decision !== before.decision || after.decided_by !== before.decided_by || after.note !== before.note) return `human fields of ${before.id} changed`;
      for (const run of before.runs) if (!after.runs.includes(run)) return `${before.id} lost run ${run}`;
    }
    const previous = new Set((store?.divergences ?? []).map((entry) => entry.id));
    for (const divergence of found) {
      const after = byId.get(divergence.id);
      if (after === undefined) return `${divergence.id} is missing`;
      if (!previous.has(divergence.id) && after.decision !== 'pending') return `new ${divergence.id} is not pending`;
    }
    for (let index = 1; index < result.divergences.length; index += 1) {
      const [a, b] = [result.divergences[index - 1], result.divergences[index]];
      if (a !== undefined && b !== undefined && ORDER[a.decision] > ORDER[b.decision]) return 'entries are not ordered pending, allow, reject';
    }
    return true;
  },
};
