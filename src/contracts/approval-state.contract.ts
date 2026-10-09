// C-64 approvalState(proposal, approvals): approved only when the latest approval of the
// proposal has the proposal's current content hash and guide version; an approval that differs
// in either is stale; no approval of the proposal is none.

import type { Approval, ApprovalState } from '../learn/approval/approvals.ts';

interface Judged {
  readonly id: string;
  readonly content_hash: string;
  readonly basis: { readonly manifest_version: string };
}

export default {
  post: (state: ApprovalState, proposal: Judged, approvals: readonly Approval[]) => {
    const latest = approvals.filter((entry) => entry.proposal === proposal.id).at(-1);
    if (latest === undefined) return state.state === 'none' || 'a state other than none without an approval';
    const matches = latest.content_hash === proposal.content_hash && latest.manifest_version === proposal.basis.manifest_version;
    if (matches) return state.state === 'approved' || 'a matching approval is not approved';
    return state.state === 'stale' || 'a non-matching approval is not stale';
  },
};
