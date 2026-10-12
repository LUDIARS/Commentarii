// Budget table proposals (schema/planning-proposals.schema.json, Ingenium R3, SDK 0.5.0): what an
// engine's offline method evaluation proposes to change in its budget table - a planner's budget
// in one cell (form / regime), from -> to, with the method report row it rests on. The file names
// the table it was made against (version and hash) and hashes its own proposal list, so an
// approval binds to exactly these changes on exactly that table. A proposal never changes a
// table: only an approved copy (approved-budget-table.ts) does.

import type { MethodReportRow } from './method-report.ts';

export const PLANNING_PROPOSALS_FORMAT = 'planning-proposals/1';

/** The planners a budget table proposal can change. */
export const BUDGET_PLANNERS = ['goap', 'mcts'] as const;
export type BudgetPlannerId = (typeof BUDGET_PLANNERS)[number];

export type BudgetProposalEvidence = Pick<MethodReportRow, 'row' | 'episodes' | 'success_rate' | 'realized_mean' | 'abs_error' | 'share'>;

export interface BudgetProposal {
  /** <cell>:<planner> */
  readonly id: string;
  /** <form>/<regime> (turn/any for the turn row). */
  readonly cell: string;
  readonly planner: BudgetPlannerId;
  readonly from: number;
  readonly to: number;
  readonly because: BudgetProposalEvidence;
}

export interface PlanningProposals {
  readonly format: typeof PLANNING_PROPOSALS_FORMAT;
  readonly table_version: string;
  /** Content hash of the table the proposals were made against. */
  readonly table_hash: string;
  readonly proposals: readonly BudgetProposal[];
  /** Content hash of `proposals` (sha256 over the canonical JSON). */
  readonly proposals_hash: string;
}
