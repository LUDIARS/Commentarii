// C-106 budgetTableProposal(proposals): a budget table proposal always waits for a person, is
// named budget-table:<table version>, changes no bundle file and carries the engine's proposal
// list and hashes unchanged.

import type { PlanningProposals } from '@ludiars/commentarii-sdk/types';
import type { ProposalDraft } from '../learn/consolidate/proposal.ts';

export default {
  post: (draft: ProposalDraft, proposals: PlanningProposals) => {
    if (draft.kind !== 'budget-table' || draft.status !== 'pending') return 'not a pending budget-table proposal';
    if (draft.id !== `budget-table:${proposals.table_version}`) return `id ${draft.id} does not name the table`;
    if (draft.files.length > 0) return 'a budget table proposal changes a bundle file';
    const budget = draft.budget;
    if (budget === undefined) return 'no budget detail';
    if (budget.proposals_hash !== proposals.proposals_hash || budget.table_hash !== proposals.table_hash) return 'hashes differ from the engine file';
    return JSON.stringify(budget.changes) === JSON.stringify(proposals.proposals) || 'the proposal list was changed';
  },
};
