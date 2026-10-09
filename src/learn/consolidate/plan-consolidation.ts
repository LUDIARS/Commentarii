// guide learn consolidate (design 6, 8.2, 8.4): the overlay -> update proposals for the
// canonical bundle (rewrites, boundary promotions, draft entities), and with --apply the file
// changes of the auto proposals only. Pure: the caller writes the changes. Without --apply,
// or with nothing auto, the bundle is left exactly as it is.

import type { Bundle } from '../../bundle/bundle.ts';
import type { FileChange } from '../../import/plan/file-change.ts';
import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import type { Overlay } from '../overlay/overlay.ts';
import type { LearningPolicy } from '../policy/learning-policy.ts';
import { applyProposals } from './apply-proposals.ts';
import { draftProposals } from './draft-proposals.ts';
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
}

export interface Consolidation {
  readonly proposals: readonly Proposal[];
  /** Proposal IDs whose changes are in `changes` (empty without --apply). */
  readonly applied: readonly string[];
  /** Proposal IDs left for a person: pending ones, and auto ones when --apply was not given. */
  readonly remaining: readonly string[];
  readonly changes: readonly FileChange[];
}

export function planConsolidation(input: ConsolidationInput): Consolidation {
  const { bundle, overlay, policy } = input;
  const proposals = [...rewriteProposals(bundle, overlay, policy), ...promotionProposals(bundle, overlay, policy), ...draftProposals(bundle, overlay)];
  const auto = input.apply ? proposals.filter((proposal) => proposal.status === 'auto') : [];
  const applied = new Set(auto.map((proposal) => proposal.id));
  return {
    proposals,
    applied: [...applied],
    remaining: proposals.filter((proposal) => !applied.has(proposal.id)).map((proposal) => proposal.id),
    changes: auto.length === 0 ? [] : applyProposals(bundle, auto, input.registry),
  };
}
// @ts-expect-error augur-inject
planConsolidation = contract(planConsolidation, { ...augurContract_603c3f6e, contractId: 'C-32', mode: 'observe', sample: 1, where: 'src/learn/consolidate/plan-consolidation.ts:34', rule: 'contract-wrap', id: '603c3f6e' }); /* augur-inject:contract-wrap:603c3f6e */
