// Human approvals of consolidate proposals (design 1 principle 5, spec/feature/learning.md §4.2):
// observations/approvals.json, written by guide learn approve and read by guide learn
// consolidate --apply. An approval is bound to what was approved, not to a proposal name:
// the proposal's content hash and the guide version it was judged against. If the proposal
// changes (new runs, other patch, other version), the approval is stale and nothing is applied.

import { contract } from '#contract-runtime'; /* augur-inject:import:0ea33bfb */
import augurContract_c7ac31ad from '../../contracts/approval-state.contract.ts'; /* augur-inject:contract-predicate:7b7991e7 */

export const APPROVALS_PATH = 'observations/approvals.json';

export interface Approval {
  readonly proposal: string;
  readonly content_hash: string;
  readonly manifest_version: string;
  readonly approved_by: string;
  readonly rationale: string;
  /** ISO 8601 (UTC). */
  readonly approved_at: string;
}

export interface ApprovalsFile {
  readonly game_id: string;
  readonly approvals: readonly Approval[];
}

export type ApprovalState =
  | { readonly state: 'approved'; readonly approval: Approval }
  | { readonly state: 'stale'; readonly approval: Approval; readonly why: string }
  | { readonly state: 'none' };

interface Judged {
  readonly id: string;
  readonly content_hash: string;
  readonly basis: { readonly manifest_version: string };
}

/** The latest approval of the proposal, and whether it still matches what is proposed now. */
export function approvalState(proposal: Judged, approvals: readonly Approval[]): ApprovalState {
  const approval = approvals.filter((entry) => entry.proposal === proposal.id).at(-1);
  if (approval === undefined) return { state: 'none' };
  if (approval.content_hash !== proposal.content_hash) return { state: 'stale', approval, why: 'the proposal changed after it was approved (content hash differs)' };
  if (approval.manifest_version !== proposal.basis.manifest_version) {
    return { state: 'stale', approval, why: `approved against guide version ${approval.manifest_version}, the bundle is ${proposal.basis.manifest_version}` };
  }
  return { state: 'approved', approval };
}
// @ts-expect-error augur-inject
approvalState = contract(approvalState, { ...augurContract_c7ac31ad, contractId: 'C-64', mode: 'observe', sample: 1, where: 'src/learn/approval/approvals.ts:36', rule: 'contract-wrap', id: 'c7ac31ad' }); /* augur-inject:contract-wrap:c7ac31ad */
