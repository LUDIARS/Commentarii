// guide learn approve (spec/feature/learning.md §4.2): records that a person approved exactly
// the proposal consolidate shows now - its content hash and guide version - with who and why.
// Pure: returns the new approvals file. Auto proposals need no approval; an unknown ID is an
// error rather than an approval of something that does not exist.

import { LearnError } from '../learn-error.ts';
import type { Proposal } from '../consolidate/proposal.ts';
import type { Approval, ApprovalsFile } from './approvals.ts';

export interface ApproveRequest {
  readonly proposals: readonly Proposal[];
  readonly current: ApprovalsFile | undefined;
  readonly gameId: string;
  readonly proposal: string;
  readonly by: string;
  readonly rationale: string;
  readonly now: Date;
}

export function approveProposal(request: ApproveRequest): { file: ApprovalsFile; approval: Approval } {
  const proposal = request.proposals.find((candidate) => candidate.id === request.proposal);
  if (proposal === undefined) throw new LearnError(`no proposal ${request.proposal} in the current consolidate (run guide learn consolidate to list them)`);
  if (proposal.status === 'auto') throw new LearnError(`${proposal.id} is auto (efficiency only); it needs no approval`);
  if (request.by.trim() === '' || request.rationale.trim() === '') throw new LearnError('an approval needs --by and --reason');
  const approval: Approval = {
    proposal: proposal.id,
    content_hash: proposal.content_hash,
    manifest_version: proposal.basis.manifest_version,
    approved_by: request.by.trim(),
    rationale: request.rationale.trim(),
    approved_at: request.now.toISOString(),
  };
  return { file: { game_id: request.gameId, approvals: [...(request.current?.approvals ?? []), approval] }, approval };
}
