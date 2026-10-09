// "効率の良い変種" (design 8.2): every measured variant compared with the tactic it comes from
// (the "same when"). A variant becomes a rewrite candidate when, counting player runs only:
//   - it has at least learning.policy.rewrite.min_runs judged runs,
//   - its composite gain (metric_weights) over the tactic is at least min_gain,
//   - its success rate is not below the tactic's (efficiency must not cost reliability).
// The tactic's baseline is its own overlay metrics when it was measured, else the bundle's.
// Candidates become overlay rewrites at once (used from the next play on, design 8.2).

import type { Bundle } from '../../bundle/bundle.ts';
import type { TacticMetrics } from '../../domain/documents.ts';
import { deriveVariant, type TacticMutation } from '../../engine/candidates/tactic-variants.ts';
import type { LearningPolicy } from '../policy/learning-policy.ts';
import type { Overlay, OverlayRewrite, OverlayTactic } from '../overlay/overlay.ts';
import { compositeGain } from './composite-gain.ts';

export type BaselineSource = 'overlay' | 'bundle';

export interface VariantComparison {
  readonly tactic: string;
  readonly of: string;
  readonly mutation: TacticMutation;
  readonly runs: number;
  readonly success: number;
  readonly baseline?: BaselineSource;
  readonly origin_success?: number;
  readonly gain?: number;
  readonly meets: boolean;
  /** Why it is or is not a rewrite candidate. */
  readonly reason: string;
}

export interface EfficientVariants {
  readonly compared: readonly VariantComparison[];
  readonly rewrites: readonly OverlayRewrite[];
}

function baselineOf(overlay: Overlay, bundle: Bundle, origin: string): { metrics: TacticMetrics; source: BaselineSource } | undefined {
  const measured = overlay.tactics.find((entry) => entry.tactic === origin && entry.variant === undefined);
  if (measured !== undefined && measured.metrics.runs > 0) return { metrics: measured.metrics, source: 'overlay' };
  const canonical = bundle.tactics.find(({ doc }) => doc.id === origin)?.doc.metrics;
  return canonical === undefined ? undefined : { metrics: canonical, source: 'bundle' };
}

function verdict(entry: OverlayTactic, policy: LearningPolicy, baseline: TacticMetrics, gain: number | undefined): { meets: boolean; reason: string } {
  const { min_runs: minRuns, min_gain: minGain } = policy.rewrite;
  if (entry.metrics.runs < minRuns) return { meets: false, reason: `${entry.metrics.runs} run(s) < min_runs ${minRuns}` };
  if (gain === undefined) return { meets: false, reason: 'no measured figure to compare' };
  if (gain < minGain) return { meets: false, reason: `gain ${gain} < min_gain ${minGain}` };
  if (entry.metrics.success < baseline.success) return { meets: false, reason: `success ${entry.metrics.success} < tactic's ${baseline.success}` };
  return { meets: true, reason: `gain ${gain} >= min_gain ${minGain} over ${entry.metrics.runs} run(s)` };
}

function rewriteOf(entry: OverlayTactic, bundle: Bundle, gain: number): OverlayRewrite | undefined {
  const variant = entry.variant;
  const origin = variant === undefined ? undefined : bundle.tactics.find(({ doc }) => doc.id === variant.of)?.doc;
  if (variant === undefined || origin === undefined) return undefined;
  const derived = deriveVariant(origin, variant.mutation);
  if (derived === undefined || derived.tactic.id !== entry.tactic) return undefined;
  return {
    tactic: { ...derived.tactic, metrics: entry.metrics },
    of: variant.of,
    mutation: variant.mutation,
    gain,
    runs: entry.metrics.runs,
    evidence: [...new Set(entry.samples.map((sample) => sample.run))],
  };
}

export function findEfficientVariants(bundle: Bundle, overlay: Overlay, policy: LearningPolicy): EfficientVariants {
  const compared: VariantComparison[] = [];
  const rewrites: OverlayRewrite[] = [];
  for (const entry of overlay.tactics) {
    const variant = entry.variant;
    if (variant === undefined) continue;
    const base = { tactic: entry.tactic, of: variant.of, mutation: variant.mutation, runs: entry.metrics.runs, success: entry.metrics.success };
    const baseline = baselineOf(overlay, bundle, variant.of);
    if (baseline === undefined) {
      compared.push({ ...base, meets: false, reason: 'the tactic has no metrics to compare with' });
      continue;
    }
    const gain = compositeGain(baseline.metrics, entry.metrics, policy.rewrite.metric_weights);
    const judged = verdict(entry, policy, baseline.metrics, gain);
    const rewrite = judged.meets && gain !== undefined ? rewriteOf(entry, bundle, gain) : undefined;
    const meets = judged.meets && rewrite !== undefined;
    compared.push({
      ...base,
      baseline: baseline.source,
      origin_success: baseline.metrics.success,
      ...(gain === undefined ? {} : { gain }),
      meets,
      reason: judged.meets && !meets ? 'the tactic is no longer in the bundle as it was measured' : judged.reason,
    });
    if (rewrite !== undefined) rewrites.push(rewrite);
  }
  return { compared, rewrites };
}
