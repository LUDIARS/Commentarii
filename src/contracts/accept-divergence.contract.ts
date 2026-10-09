// C-52 acceptDivergence(input): the stage intent changes only by allowed_divergences gaining at
// most one entry, which names the divergence and the person; the store entry becomes allow by
// that person; no other store entry changes; no tactic is returned (promotion is only reported).

import type { AcceptInput, AcceptResult } from '../verify/intent/accept-divergence.ts';

export default {
  post: (result: AcceptResult, input: AcceptInput) => {
    const { allowed_divergences: beforeAllowed, ...beforeRest } = result.before;
    const { allowed_divergences: afterAllowed, ...afterRest } = result.intent;
    if (JSON.stringify(beforeRest) !== JSON.stringify(afterRest)) return 'accept changed the intent beyond allowed_divergences';
    if (JSON.stringify(afterAllowed.slice(0, beforeAllowed.length)) !== JSON.stringify(beforeAllowed)) return 'accept rewrote existing allowed divergences';
    const added = afterAllowed.slice(beforeAllowed.length);
    if (added.length > 1) return 'accept added more than one allowed divergence';
    if (result.changed !== (added.length === 1)) return 'changed does not match the intent';
    for (const entry of added) if (entry.divergence !== input.id || entry.decided_by !== input.by) return 'the added entry does not name the divergence and the person';
    if (result.entry.decision !== 'allow' || result.entry.decided_by !== input.by) return 'the store entry is not allowed by the person';
    for (const stored of result.store.divergences) {
      if (stored.id === input.id) continue;
      const original = input.store.divergences.find((entry) => entry.id === stored.id);
      if (JSON.stringify(original) !== JSON.stringify(stored)) return `accept changed ${stored.id}`;
    }
    if ('tactics' in result) return 'accept returned tactics';
    return true;
  },
};
