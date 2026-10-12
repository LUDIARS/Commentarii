// An approved budget table proposal (schema/approved-budget-table.schema.json, Ingenium R3, SDK
// 0.5.0): the proposal file exactly as it was made plus the approval naming its proposals hash
// and who approved. Commentarii writes it from guide learn approve + consolidate --apply (the
// same approval path as the tactic rewrites, design 8.2); the engine applies it only to the very
// table the proposals were made against and refuses a missing or mismatched approval.

import type { PlanningProposals } from './planning-proposals.ts';

export const APPROVED_BUDGET_TABLE_FORMAT = 'approved-budget-table/1';

export interface BudgetTableApproval {
  /** Must equal proposals.proposals_hash (and the hash of proposals.proposals). */
  readonly proposals_hash: string;
  readonly approved_by: string;
  /** ISO 8601 (UTC). */
  readonly approved_at?: string;
}

export interface ApprovedBudgetTable {
  readonly format: typeof APPROVED_BUDGET_TABLE_FORMAT;
  readonly proposals: PlanningProposals;
  readonly approval: BudgetTableApproval;
}
