// C-66 sealProposal(draft, context): the sealed proposal keeps the draft's patches, evidence and
// verdict, its basis carries the game, guide version, builds, the draft's condition and the
// metric units, and its content hash does not depend on status / reason but changes with the files.

import { contentHash } from '../learn/approval/proposal-hash.ts';
import type { BasisContext } from '../learn/approval/seal-proposal.ts';
import type { Proposal, ProposalDraft } from '../learn/consolidate/proposal.ts';

export default {
  post: (sealed: Proposal, draft: ProposalDraft, context: BasisContext) => {
    if (sealed.files !== draft.files || sealed.evidence !== draft.evidence || sealed.status !== draft.status) return 'the draft content was not kept';
    if (sealed.basis.game_id !== context.game_id || sealed.basis.manifest_version !== context.manifest_version) return 'the basis lost the game or version';
    if (draft.condition !== undefined && sealed.basis.condition !== draft.condition) return 'the basis lost the condition';
    if (Object.keys(sealed.basis.units).length === 0) return 'the basis has no units';
    const { status: _status, reason: _reason, content_hash: _hash, ...judged } = sealed;
    if (contentHash(judged) !== sealed.content_hash) return 'the content hash is not over the judged content';
    if (contentHash({ ...judged, files: [] }) === sealed.content_hash && draft.files.length > 0) return 'the content hash ignores the files';
    return true;
  },
};
