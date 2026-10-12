// An engine's budget table proposals (planning-proposals/1, Ingenium's offline method evaluation)
// as one consolidate proposal (design 8.2's approval flow, SDK 0.5.0). A budget table change is a
// change of how the engine thinks, not an efficiency rewrite of a tactic, so it always waits for a
// person. The content hash covers the whole proposal list and the table it was made against, so
// new proposals void an approval. Approved, it becomes approved-budget-table/1: the proposal file
// exactly as the engine made it plus the approval (who, when, the proposals hash).

import {
  APPROVED_BUDGET_TABLE_FORMAT,
  APPROVED_BUDGET_TABLE_PATH,
  PLANNING_PROPOSALS_FORMAT,
  PLANNING_PROPOSALS_PATH,
  type ApprovedBudgetTable,
  type PlanningProposals,
} from '@ludiars/commentarii-sdk/types';
import type { Approval } from '../approval/approvals.ts';
import type { BudgetTableDetail, ProposalDraft } from '../consolidate/proposal.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:49f30ddb */
import augurContract_8e763527 from '../../contracts/budget-table-proposal.contract.ts'; /* augur-inject:contract-predicate:79308a8d */
import augurContract_8f5b66ec from '../../contracts/approved-budget-table.contract.ts'; /* augur-inject:contract-predicate:6a8e9196 */

export function budgetTableProposal(proposals: PlanningProposals): ProposalDraft {
  const budget: BudgetTableDetail = {
    source: PLANNING_PROPOSALS_PATH,
    target: APPROVED_BUDGET_TABLE_PATH,
    table_version: proposals.table_version,
    table_hash: proposals.table_hash,
    proposals_hash: proposals.proposals_hash,
    changes: proposals.proposals,
  };
  return {
    id: `budget-table:${proposals.table_version}`,
    kind: 'budget-table',
    status: 'pending',
    reason: 'a budget table change alters how the engine decides: always reviewed by a person',
    files: [],
    evidence: [],
    budget,
  };
}
// @ts-expect-error augur-inject
budgetTableProposal = contract(budgetTableProposal, { ...augurContract_8e763527, contractId: 'C-106', mode: 'observe', sample: 1, where: 'src/learn/budget/budget-table-proposal.ts:19', rule: 'contract-wrap', id: '8e763527' }); /* augur-inject:contract-wrap:8e763527 */

/** The proposal file as the engine wrote it (same key order), rebuilt from the reviewed detail. */
export function planningProposalsOf(budget: BudgetTableDetail): PlanningProposals {
  return { format: PLANNING_PROPOSALS_FORMAT, table_version: budget.table_version, table_hash: budget.table_hash, proposals: budget.changes, proposals_hash: budget.proposals_hash };
}

export function approvedBudgetTable(budget: BudgetTableDetail, approval: Approval): ApprovedBudgetTable {
  return {
    format: APPROVED_BUDGET_TABLE_FORMAT,
    proposals: planningProposalsOf(budget),
    approval: { proposals_hash: budget.proposals_hash, approved_by: approval.approved_by, approved_at: approval.approved_at },
  };
}
// @ts-expect-error augur-inject
approvedBudgetTable = contract(approvedBudgetTable, { ...augurContract_8f5b66ec, contractId: 'C-107', mode: 'observe', sample: 1, where: 'src/learn/budget/budget-table-proposal.ts:44', rule: 'contract-wrap', id: '8f5b66ec' }); /* augur-inject:contract-wrap:8f5b66ec */
