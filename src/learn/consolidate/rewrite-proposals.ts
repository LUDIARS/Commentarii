// Tactic rewrite proposals (design 8.2) from the overlay's rewrite candidates: the variant
// becomes tactics/<its slug>.json (learned, with its measured metrics) and the old tactic is
// kept with superseded_by pointing at it (never removed). Auto only when
// learning.policy.rewrite.auto_apply is true and the rewrite does not touch the intent;
// otherwise it waits for approval (relax variants always wait: they change the condition).
// Already applied or already superseded rewrites are skipped.

import type { Bundle } from '../../bundle/bundle.ts';
import type { TacticMetrics } from '../../domain/documents.ts';
import { parseRef } from '../../domain/id.ts';
import type { Overlay, OverlayRewrite } from '../overlay/overlay.ts';
import type { LearningPolicy } from '../policy/learning-policy.ts';
import { intentTouch } from './intent-touch.ts';
import type { ProposalDraft } from './proposal.ts';

function statusOf(policy: LearningPolicy, rewrite: OverlayRewrite, touch: string | undefined): Pick<ProposalDraft, 'status' | 'reason'> {
  // relax loosens `when`: the variant runs in situations the original never did, so its gain is
  // not a same-condition efficiency comparison and cannot be applied by rule (learning.md §4.1).
  if (rewrite.mutation === 'relax') return { status: 'pending', reason: 'relax changes the when condition: not a same-condition efficiency comparison' };
  if (touch !== undefined) return { status: 'pending', reason: `touches the intent: ${touch}` };
  if (!policy.rewrite.auto_apply) return { status: 'pending', reason: 'learning.policy.rewrite.auto_apply is false' };
  return { status: 'auto', reason: 'efficiency only (auto_apply, same condition, intent untouched)' };
}

function timeOf(metrics: TacticMetrics | undefined): number | undefined {
  return metrics?.time_sec?.p50;
}

function proposalOf(bundle: Bundle, overlay: Overlay, policy: LearningPolicy, rewrite: OverlayRewrite): ProposalDraft | undefined {
  const origin = bundle.tactics.find(({ doc }) => doc.id === rewrite.of);
  const slug = parseRef(rewrite.tactic.id)?.slug;
  if (origin === undefined || slug === undefined) return undefined;
  if (bundle.tactics.some(({ doc }) => doc.id === rewrite.tactic.id) || origin.doc.superseded_by !== null) return undefined;
  const measured = overlay.tactics.find((entry) => entry.tactic === rewrite.tactic.id);
  const originMetrics = overlay.tactics.find((entry) => entry.tactic === rewrite.of && entry.variant === undefined && entry.metrics.runs > 0)?.metrics ?? origin.doc.metrics;
  const variantTime = timeOf(rewrite.tactic.metrics);
  const change = { supersedes: true, timeChanged: variantTime !== undefined && variantTime !== timeOf(originMetrics) };
  const touch = intentTouch(bundle.intents.map(({ doc }) => doc), [origin.doc, rewrite.tactic], measured?.nodes ?? [], change);
  return {
    id: `rewrite:${rewrite.of}`,
    kind: 'rewrite',
    ...statusOf(policy, rewrite, touch),
    condition: origin.doc.when,
    files: [
      { path: `tactics/${slug}.json`, create: true, patch: [{ op: 'add', path: '', value: rewrite.tactic }] },
      {
        path: origin.path,
        create: false,
        patch: [
          { op: 'test', path: '/superseded_by', value: null },
          { op: 'replace', path: '/superseded_by', value: rewrite.tactic.id },
        ],
      },
    ],
    evidence: rewrite.evidence,
    rewrite: {
      of: rewrite.of,
      mutation: rewrite.mutation,
      before: { when: origin.doc.when, do: origin.doc.do },
      after: { when: rewrite.tactic.when, do: rewrite.tactic.do },
      ...(originMetrics === undefined ? {} : { origin_metrics: originMetrics }),
      variant_metrics: rewrite.tactic.metrics ?? { runs: rewrite.runs, success: 0 },
      gain: rewrite.gain,
    },
  };
}

export function rewriteProposals(bundle: Bundle, overlay: Overlay, policy: LearningPolicy): ProposalDraft[] {
  // One rewrite per tactic: the best gain wins when several of its variants qualify.
  const best = new Map<string, OverlayRewrite>();
  for (const rewrite of overlay.rewrites) {
    const current = best.get(rewrite.of);
    if (current === undefined || rewrite.gain > current.gain) best.set(rewrite.of, rewrite);
  }
  return [...best.values()].map((rewrite) => proposalOf(bundle, overlay, policy, rewrite)).filter((proposal): proposal is ProposalDraft => proposal !== undefined);
}
