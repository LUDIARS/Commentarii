// "考慮項目の重みの微調整" (design 8.1): a bounded nudge of the persona's exploration weight
// from how exploration paid off. Among variants measured on at least min_runs runs, each that
// met min_gain is a win and each slower than its tactic (gain < 0) a loss; the exploration
// weight is scaled by 1 + WEIGHT_STEP * (wins - losses) / compared, kept within the bounds.
// Without enough measured variants the weights stay as they are (no entry).

import type { ConsiderationName } from '../../engine/persona/persona.ts';
import type { VariantComparison } from '../ingest/efficient-variants.ts';
import type { LearningPolicy } from '../policy/learning-policy.ts';
import { round3 } from '../stats/round.ts';

export const WEIGHT_STEP = 0.2;
export const WEIGHT_BOUNDS = [0.8, 1.2] as const;

export function tuneWeights(compared: readonly VariantComparison[], policy: LearningPolicy): Partial<Record<ConsiderationName, number>> {
  const measured = compared.filter((entry) => entry.gain !== undefined && entry.runs >= policy.rewrite.min_runs);
  if (measured.length === 0) return {};
  const wins = measured.filter((entry) => (entry.gain ?? 0) >= policy.rewrite.min_gain).length;
  const losses = measured.filter((entry) => (entry.gain ?? 0) < 0).length;
  const factor = 1 + (WEIGHT_STEP * (wins - losses)) / measured.length;
  return { exploration: round3(Math.min(Math.max(factor, WEIGHT_BOUNDS[0]), WEIGHT_BOUNDS[1])) };
}
