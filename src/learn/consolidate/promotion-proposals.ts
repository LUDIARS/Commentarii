// Boundary promotion candidates (design 5, 8.4): a masked value that player runs keep
// estimating correctly is discoverable by play. It becomes a candidate when the player runs
// with an estimate reach promotion.discoverable_requires.player_runs and the share of them
// agreeing with the value reaches .agreement. Only runs the overlay lists as player runs count
// (omniscient observation is never evidence, principle 2). Never applied automatically: the
// proposal moves the value from the .masked.json to the entity file as discoverable, keeping
// its value and source kind and adding the evidence runs to the source ref, for a person to approve.

import type { Bundle } from '../../bundle/bundle.ts';
import type { GuideValue } from '../../domain/documents.ts';
import type { Overlay, OverlayValue } from '../overlay/overlay.ts';
import { pointerSegment, type JsonPatchOperation } from '../patch/json-patch.ts';
import type { LearningPolicy } from '../policy/learning-policy.ts';
import { resolveQuantity, type CanonicalValue } from '../values/resolve-quantity.ts';
import { summarizeAgreement } from '../values/value-agreement.ts';
import type { ProposalDraft } from './proposal.ts';

function promotedValue(canonical: CanonicalValue, runs: readonly string[], agreement: number): GuideValue<number> {
  const { value } = canonical;
  return {
    ...value,
    knowledge: 'discoverable',
    source: { kind: value.source.kind, ref: `${value.source.ref}; discoverable by play: ${runs.join(' ')} (agreement ${agreement})` },
  };
}

function entityPatch(bundle: Bundle, canonical: CanonicalValue, entity: string, promoted: GuideValue<number>): { path: string; patch: JsonPatchOperation[] } | undefined {
  const open = bundle.entities.find(({ doc }) => doc.id === entity);
  if (open === undefined) return undefined;
  const add: JsonPatchOperation = { op: 'add', path: `/stats/${pointerSegment(canonical.key)}`, value: promoted };
  return { path: open.path, patch: open.doc.stats === undefined ? [{ op: 'add', path: '/stats', value: {} }, add] : [add] };
}

function proposalOf(bundle: Bundle, overlay: Overlay, policy: LearningPolicy, entry: OverlayValue): ProposalDraft | undefined {
  const canonical = resolveQuantity(bundle, entry.entity, entry.quantity);
  if (canonical === undefined || !canonical.masked) return undefined;
  const player = new Set(overlay.runs.player);
  const estimates = entry.estimates.filter((estimate) => player.has(estimate.run));
  const summary = summarizeAgreement(estimates, canonical.value.value);
  const requires = policy.promotion.discoverable_requires;
  if (summary.agreement === undefined || summary.runs < requires.player_runs || summary.agreement < requires.agreement) return undefined;
  const promoted = promotedValue(canonical, summary.agreeing, summary.agreement);
  const target = entityPatch(bundle, canonical, entry.entity, promoted);
  if (target === undefined) return undefined;
  const pointer = `/stats/${pointerSegment(canonical.key)}`;
  return {
    id: `promotion:${canonical.ref}`,
    kind: 'promotion',
    status: 'pending',
    reason: 'boundary promotion needs human approval (design 5)',
    files: [
      { path: canonical.file, create: false, patch: [{ op: 'test', path: `${pointer}/value`, value: canonical.value.value }, { op: 'remove', path: pointer }] },
      { path: target.path, create: false, patch: target.patch },
    ],
    evidence: summary.agreeing,
    promotion: { ref: canonical.ref, value: canonical.value.value, player_runs: summary.runs, agreement: summary.agreement, requires },
  };
}

export function promotionProposals(bundle: Bundle, overlay: Overlay, policy: LearningPolicy): ProposalDraft[] {
  return overlay.values.map((entry) => proposalOf(bundle, overlay, policy, entry)).filter((proposal): proposal is ProposalDraft => proposal !== undefined);
}
