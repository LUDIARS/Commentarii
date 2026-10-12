// guide learn consolidate (design 6, 8.2, 8.4, 14.D): the overlay and the human candidates ->
// update proposals for the canonical bundle (rewrites, boundary promotions, draft entities,
// human tactics), each sealed with its basis and content hash. With --apply, the file changes
// of the auto proposals and of the pending ones holding a valid approval (same content hash,
// same guide version). Pure: the caller writes the changes. Without --apply, or with nothing
// applicable, the bundle is left exactly as it is. An engine's budget table proposals (SDK 0.5.0)
// go the same way and, approved, become observations/planning/approved-budget-table.json.

import { APPROVED_BUDGET_TABLE_PATH, type Bundle, type Overlay, type PlanningProposals } from '@ludiars/commentarii-sdk/types';
import type { FileChange } from '../../import/plan/file-change.ts';
import type { HumanCandidates } from '../../import/plays/human-candidates.ts';
import type { SchemaRegistry } from '@ludiars/commentarii-sdk/schemas';
import { approvalState, type Approval } from '../approval/approvals.ts';
import { approvedBudgetTable, budgetTableProposal } from '../budget/budget-table-proposal.ts';
import { LearnError } from '../learn-error.ts';
import { sealProposal } from '../approval/seal-proposal.ts';
import type { LearningPolicy } from '../policy/learning-policy.ts';
import { applyProposals } from './apply-proposals.ts';
import { draftProposals } from './draft-proposals.ts';
import { humanTacticProposals } from './human-tactic-proposals.ts';
import { promotionProposals } from './promotion-proposals.ts';
import type { Proposal } from './proposal.ts';
import { rewriteProposals } from './rewrite-proposals.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:c9163b44 */
import augurContract_603c3f6e from '../../contracts/plan-consolidation.contract.ts'; /* augur-inject:contract-predicate:4e558cd9 */

export interface ConsolidationInput {
  readonly bundle: Bundle;
  readonly overlay: Overlay;
  readonly policy: LearningPolicy;
  readonly apply: boolean;
  readonly registry: SchemaRegistry;
  /** observations/approvals.json entries (none = nothing approved). */
  readonly approvals?: readonly Approval[];
  /** observations/human/candidates.json, when guide import plays wrote one. */
  readonly humanCandidates?: HumanCandidates;
  /** observations/planning/proposals.json, when the engine proposed budget table changes. */
  readonly planningProposals?: PlanningProposals;
}

export interface StaleApproval {
  readonly proposal: string;
  readonly why: string;
}

export interface Consolidation {
  readonly proposals: readonly Proposal[];
  /** Proposal IDs whose changes are in `changes` (empty without --apply). */
  readonly applied: readonly string[];
  /** Pending proposals applicable because a person approved exactly this content. */
  readonly approved: readonly string[];
  /** Approvals that no longer match their proposal: never applied, to be approved again. */
  readonly stale: readonly StaleApproval[];
  /** Proposal IDs left for a person: pending ones, and auto ones when --apply was not given. */
  readonly remaining: readonly string[];
  readonly changes: readonly FileChange[];
}

export function planConsolidation(input: ConsolidationInput): Consolidation {
  const { bundle, overlay, policy } = input;
  const manifest = bundle.manifest?.doc;
  const context = { game_id: overlay.game_id, manifest_version: manifest?.version ?? '', builds: manifest?.builds ?? [] };
  const drafts = [
    ...rewriteProposals(bundle, overlay, policy),
    ...promotionProposals(bundle, overlay, policy),
    ...draftProposals(bundle, overlay),
    ...humanTacticProposals(bundle, input.humanCandidates),
    ...(input.planningProposals === undefined ? [] : [budgetTableProposal(input.planningProposals)]),
  ];
  const proposals = drafts.map((draft) => sealProposal(draft, context));
  const approved: string[] = [];
  const stale: StaleApproval[] = [];
  for (const proposal of proposals) {
    if (proposal.status === 'auto') continue;
    const state = approvalState(proposal, input.approvals ?? []);
    if (state.state === 'approved') approved.push(proposal.id);
    if (state.state === 'stale') stale.push({ proposal: proposal.id, why: state.why });
  }
  const applicable = input.apply ? proposals.filter((proposal) => proposal.status === 'auto' || approved.includes(proposal.id)) : [];
  const applied = new Set(applicable.map((proposal) => proposal.id));
  const documents = applicable.filter((proposal) => proposal.kind !== 'budget-table');
  const budgets = applicable.flatMap((proposal) => {
    const approval = approvalState(proposal, input.approvals ?? []);
    if (proposal.budget === undefined || approval.state !== 'approved') return [];
    const after = approvedBudgetTable(proposal.budget, approval.approval);
    const violations = input.registry.validate('approved-budget-table', after);
    if (violations.length > 0) throw new LearnError(`${proposal.id}: the approved budget table would be invalid: ${violations.map((v) => `${v.pointer} ${v.message}`).join('; ')}`);
    return [{ path: APPROVED_BUDGET_TABLE_PATH, before: undefined, after }];
  });
  return {
    proposals,
    applied: [...applied],
    approved,
    stale,
    remaining: proposals.filter((proposal) => !applied.has(proposal.id)).map((proposal) => proposal.id),
    changes: [...(documents.length === 0 ? [] : applyProposals(bundle, documents, input.registry)), ...budgets],
  };
}
// @ts-expect-error augur-inject
planConsolidation = contract(planConsolidation, { ...augurContract_603c3f6e, contractId: 'C-32', mode: 'observe', sample: 1, where: 'src/learn/consolidate/plan-consolidation.ts:34', rule: 'contract-wrap', id: '603c3f6e' }); /* augur-inject:contract-wrap:603c3f6e */
