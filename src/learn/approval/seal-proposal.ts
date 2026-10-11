// Seals a generated proposal with its basis (game, guide version, builds, condition, units) and
// the content hash an approval binds to. status / reason are left out of the hash: they are
// the tool's own verdict, not what the approver judges.

import type { Proposal, ProposalBasis, ProposalDraft } from '../consolidate/proposal.ts';
import { contentHash } from './proposal-hash.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:97eeb133 */
import augurContract_7a90bc6a from '../../contracts/seal-proposal.contract.ts'; /* augur-inject:contract-predicate:0fc44486 */

/** Units of the measured comparison (spec/feature/learning.md §3, §6). */
export const METRIC_UNITS: Readonly<Record<string, string>> = {
  time: 'seconds, time_sec.p50 over judged tactic runs',
  resource: 'resource units consumed, summed over resources',
  risk: 'damage taken, HP bar percent (full = 100), p50',
  success: 'share of judged runs that met expect',
};

export type BasisContext = Pick<ProposalBasis, 'game_id' | 'manifest_version' | 'builds'>;

export function sealProposal(draft: ProposalDraft, context: BasisContext): Proposal {
  const { condition, ...rest } = draft;
  const basis: ProposalBasis = { ...context, ...(condition === undefined ? {} : { condition }), units: METRIC_UNITS };
  const { status: _status, reason: _reason, ...judged } = { ...rest, basis };
  return { ...rest, basis, content_hash: contentHash(judged) };
}
// @ts-expect-error augur-inject
sealProposal = contract(sealProposal, { ...augurContract_7a90bc6a, contractId: 'C-66', mode: 'observe', sample: 1, where: 'src/learn/approval/seal-proposal.ts:18', rule: 'contract-wrap', id: '7a90bc6a' }); /* augur-inject:contract-wrap:7a90bc6a */
