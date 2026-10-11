// Accepted divergences -> learned tactics worth promoting to authored (design 8.3: "許容された手は
// learned -> authored へ昇格可"). Only reported; the canonical tactics are never rewritten here.
// A tactic is learned when the bundle says so, or when it is an exploration variant
// (<tactic>--<mutation>) the bundle does not hold at all.

import type { Tactic } from '../../domain/documents.ts';
import type { DivergenceSignature } from '../../domain/documents.ts';

export interface PromotionCandidate {
  readonly tactic: string;
  readonly divergence: string;
  /** bundle: a learned tactic of the bundle; variant: an exploration variant not in the bundle. */
  readonly origin: 'bundle' | 'variant';
}

export function promotionCandidates(divergence: string, signature: DivergenceSignature, tactics: readonly Tactic[]): PromotionCandidate[] {
  const byId = new Map(tactics.map((tactic) => [tactic.id, tactic]));
  const candidates: PromotionCandidate[] = [];
  for (const id of new Set(signature.tactics)) {
    const tactic = byId.get(id);
    if (tactic?.confidence === 'learned') candidates.push({ tactic: id, divergence, origin: 'bundle' });
    else if (tactic === undefined && id.includes('--')) candidates.push({ tactic: id, divergence, origin: 'variant' });
  }
  return candidates;
}
