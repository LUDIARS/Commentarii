// C-107 approvedBudgetTable(budget, approval): the approved table carries the reviewed proposals
// exactly (same hashes and list) and an approval naming their hash, by the approver of the
// approval record.

import type { ApprovedBudgetTable } from '@ludiars/commentarii-sdk/types';
import type { Approval } from '../learn/approval/approvals.ts';
import type { BudgetTableDetail } from '../learn/consolidate/proposal.ts';

export default {
  post: (approved: ApprovedBudgetTable, budget: BudgetTableDetail, approval: Approval) => {
    if (approved.approval.proposals_hash !== budget.proposals_hash || approved.proposals.proposals_hash !== budget.proposals_hash) return 'the approval does not name the reviewed proposals';
    if (approved.approval.approved_by !== approval.approved_by) return 'approved by someone else than the approval record';
    if (approved.proposals.table_hash !== budget.table_hash || approved.proposals.table_version !== budget.table_version) return 'another base table';
    return JSON.stringify(approved.proposals.proposals) === JSON.stringify(budget.changes) || 'the proposal list was changed';
  },
};
