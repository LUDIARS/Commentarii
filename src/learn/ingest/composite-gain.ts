// The composite efficiency gain of a variant over its tactic (design 8.2: "合成指標
// (metric_weights)"): per dimension the relative saving (before - after) / max(before, after),
// in -1..1 and well defined at 0, then the weighted mean over the dimensions both sides
// measured (time p50, resource spent in total, damage taken p50). Undefined when no dimension
// can be compared. Success rate is not part of it; the rewrite rule checks it separately.

import type { TacticMetrics } from '../../domain/documents.ts';
import type { MetricWeights } from '../policy/learning-policy.ts';
import { round3 } from '../stats/round.ts';

function total(values: Readonly<Record<string, number>> | undefined): number | undefined {
  return values === undefined ? undefined : Object.values(values).reduce((sum, value) => sum + Math.max(value, 0), 0);
}

function saving(before: number | undefined, after: number | undefined): number | undefined {
  if (before === undefined || after === undefined) return undefined;
  const scale = Math.max(before, after);
  return scale <= 0 ? 0 : (before - after) / scale;
}

export function compositeGain(origin: TacticMetrics, variant: TacticMetrics, weights: MetricWeights): number | undefined {
  const parts: [number, number | undefined][] = [
    [weights.time, saving(origin.time_sec?.p50, variant.time_sec?.p50)],
    [weights.resource, saving(total(origin.resource), total(variant.resource))],
    [weights.risk, saving(total(origin.risk), total(variant.risk))],
  ];
  let weighted = 0;
  let weightSum = 0;
  for (const [weight, part] of parts) {
    if (part === undefined || weight <= 0) continue;
    weighted += weight * part;
    weightSum += weight;
  }
  return weightSum > 0 ? round3(weighted / weightSum) : undefined;
}
