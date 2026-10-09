// Measured results of a tactic (design 4.4 metrics): half success rate, half the time /
// resource / risk figures weighted by the manifest's learning.policy.rewrite.metric_weights.

import type { TacticMetrics } from '../../domain/documents.ts';
import type { MetricWeights } from '../world/engine-world.ts';
import type { Consideration } from './utility-context.ts';

const TIME_SCALE_SEC = 10;
const RISK_SCALE = 10;
const RESOURCE_SCALE = 50;
/** Score of a figure the tactic has not measured. */
const UNMEASURED = 0.5;

function total(values: Readonly<Record<string, number>> | undefined): number {
  return Object.values(values ?? {}).reduce((sum, value) => sum + Math.max(value, 0), 0);
}

function costScore(metrics: TacticMetrics, weights: MetricWeights): number {
  const p50 = metrics.time_sec?.p50;
  const time = p50 === undefined ? UNMEASURED : 1 / (1 + p50 / TIME_SCALE_SEC);
  const risk = metrics.risk === undefined ? UNMEASURED : 1 / (1 + total(metrics.risk) / RISK_SCALE);
  const resource = metrics.resource === undefined ? UNMEASURED : 1 / (1 + total(metrics.resource) / RESOURCE_SCALE);
  return weights.time * time + weights.risk * risk + weights.resource * resource;
}

export const metricsConsideration: Consideration = (candidate, { world }) => {
  const metrics = candidate.traits.metrics;
  if (metrics === undefined) return undefined;
  return 0.5 * metrics.success + 0.5 * costScore(metrics, world.metricWeights);
};
