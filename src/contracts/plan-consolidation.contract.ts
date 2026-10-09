// C-32 planConsolidation(input): without --apply nothing changes; only auto proposals are
// applied; a proposal is auto only for a tactic rewrite under auto_apply that no intent
// `teach` refers to; promotions and draft entities always wait for a person; applying never
// removes a file and keeps the old tactic with superseded_by set.

import type { Consolidation, ConsolidationInput } from '../learn/consolidate/plan-consolidation.ts';

function field(document: unknown, key: string): unknown {
  return typeof document === 'object' && document !== null ? (document as Record<string, unknown>)[key] : undefined;
}

export default {
  post: (result: Consolidation, input: ConsolidationInput) => {
    if (!input.apply && (result.changes.length > 0 || result.applied.length > 0)) return 'changes without --apply';
    const byId = new Map(result.proposals.map((proposal) => [proposal.id, proposal]));
    const taught = new Set(input.bundle.intents.flatMap(({ doc }) => doc.intended.flatMap((item) => (item.kind === 'teach' ? [item.tactic] : []))));
    for (const proposal of result.proposals) {
      if (proposal.kind !== 'rewrite' && proposal.status !== 'pending') return `${proposal.id} is a ${proposal.kind} but not pending`;
      if (proposal.status === 'auto' && !input.policy.rewrite.auto_apply) return `${proposal.id} is auto while auto_apply is false`;
      if (proposal.status === 'auto' && proposal.rewrite !== undefined && taught.has(proposal.rewrite.of)) return `${proposal.id} replaces a taught tactic automatically`;
    }
    for (const id of result.applied) if (byId.get(id)?.status !== 'auto') return `${id} was applied without being auto`;
    const allowed = new Set(result.applied.flatMap((id) => byId.get(id)?.files.map((file) => file.path) ?? []));
    for (const change of result.changes) {
      if (change.after === undefined) return `${change.path} would be removed`;
      if (!allowed.has(change.path)) return `${change.path} is changed by no applied proposal`;
    }
    for (const id of result.applied) {
      const rewrite = byId.get(id)?.rewrite;
      if (rewrite === undefined) continue;
      const kept = result.changes.find((change) => field(change.after, 'id') === rewrite.of);
      if (kept === undefined || typeof field(kept.after, 'superseded_by') !== 'string') return `${rewrite.of} is not kept with superseded_by`;
    }
    return true;
  },
};
