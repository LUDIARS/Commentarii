// Two live bench results -> the balance comparison (spec/feature/balance-gate.md §3, Astra
// review P1-6). Comparable only when the comparability keys agree (same personas, seeds, budget,
// mode, purpose, decision mode, tactics, adapter); otherwise the comparison is refused with the
// reasons and carries no metric at all - an apples-to-oranges delta is never shown. What differs
// between base and head (guide, overlay, engine, build) is listed as the change under test.
// The evidence is the sim: a candidate is a measured change in the simulated game, not a verified
// change of the players' experience.

import type { BenchResult } from '../bench/bench-result.ts';
import type { BenchThresholds } from './bench-thresholds.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:2b99dbab */
import augurContract_2b88a248 from '../contracts/compare-bench.contract.ts'; /* augur-inject:contract-predicate:6698819d */

export interface MetricDelta {
  readonly metric: 'clear_rate' | 'time_p50' | 'time_p90' | 'damage_p50';
  readonly base: number | null;
  readonly head: number | null;
  /** clear_rate: head - base; time / damage: (head - base) / base. null when not measurable. */
  readonly change: number | null;
  readonly threshold: number;
  readonly exceeded: boolean;
}

export interface BalanceComparison {
  readonly kind: 'live-balance';
  readonly evidence: 'sim';
  readonly comparable: boolean;
  /** Why the results cannot be compared (empty when comparable). */
  readonly incompatibilities: readonly string[];
  /** What changed between base and head (the change under test). */
  readonly changed: readonly string[];
  readonly metrics: readonly MetricDelta[];
  /** Undesirable divergences in head that base did not have (coverage benches). */
  readonly new_undesirable: readonly string[];
  /** Experience-block candidates: exceeded metrics and new undesirable divergences. */
  readonly candidates: readonly string[];
}

const COMPATIBILITY_KEYS = ['adapter', 'persona', 'persona_hash', 'seed', 'seeds', 'runs', 'ticks', 'mode', 'purpose', 'decision_mode', 'tactics'] as const;
const VERSION_KEYS = ['manifest_version', 'game_builds', 'bundle_hash', 'overlay_hash', 'engine_version'] as const;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function incompatibilities(base: BenchResult, head: BenchResult): string[] {
  const reasons: string[] = [];
  if (base.game_id !== head.game_id) reasons.push(`game_id differs (${base.game_id} vs ${head.game_id})`);
  if (base.format !== head.format || base.kind !== head.kind || base.evidence !== head.evidence) reasons.push('result format, kind or evidence differs');
  for (const key of COMPATIBILITY_KEYS) if (!same(base.compatibility[key], head.compatibility[key])) reasons.push(`${key} differs`);
  return reasons;
}

function relative(base: number | null, head: number | null): number | null {
  if (base === null || head === null) return null;
  if (base === 0) return head === 0 ? 0 : null;
  return Math.round(((head - base) / base) * 1e4) / 1e4;
}

function metricDeltas(base: BenchResult, head: BenchResult, thresholds: BenchThresholds): MetricDelta[] {
  const clear = Math.round((head.metrics.clear_rate - base.metrics.clear_rate) * 1e4) / 1e4;
  const time = relative(base.metrics.time_p50, head.metrics.time_p50);
  const tail = relative(base.metrics.time_p90, head.metrics.time_p90);
  const damage = relative(base.metrics.damage_p50, head.metrics.damage_p50);
  return [
    { metric: 'clear_rate', base: base.metrics.clear_rate, head: head.metrics.clear_rate, change: clear, threshold: thresholds.clear_rate_drop, exceeded: -clear > thresholds.clear_rate_drop },
    { metric: 'time_p50', base: base.metrics.time_p50, head: head.metrics.time_p50, change: time, threshold: thresholds.time_p50_increase, exceeded: time !== null && time > thresholds.time_p50_increase },
    { metric: 'time_p90', base: base.metrics.time_p90, head: head.metrics.time_p90, change: tail, threshold: thresholds.time_p90_increase, exceeded: tail !== null && tail > thresholds.time_p90_increase },
    { metric: 'damage_p50', base: base.metrics.damage_p50, head: head.metrics.damage_p50, change: damage, threshold: thresholds.damage_p50_increase, exceeded: damage !== null && damage > thresholds.damage_p50_increase },
  ];
}

export function compareBench(base: BenchResult, head: BenchResult, thresholds: BenchThresholds): BalanceComparison {
  const reasons = incompatibilities(base, head);
  const changed = VERSION_KEYS.filter((key) => !same(base.versions[key], head.versions[key])).map((key) => key);
  if (reasons.length > 0) return { kind: 'live-balance', evidence: 'sim', comparable: false, incompatibilities: reasons, changed, metrics: [], new_undesirable: [], candidates: [] };
  const metrics = metricDeltas(base, head, thresholds);
  const known = new Set(base.divergences?.undesirable ?? []);
  const fresh = (head.divergences?.undesirable ?? []).filter((id) => !known.has(id));
  const divergenceCandidate = fresh.length >= thresholds.new_undesirable_divergence && fresh.length > 0 ? [`new undesirable divergence(s): ${fresh.join(', ')}`] : [];
  const candidates = [...metrics.filter((metric) => metric.exceeded).map((metric) => `${metric.metric} changed by ${metric.change} (threshold ${metric.threshold})`), ...divergenceCandidate];
  return { kind: 'live-balance', evidence: 'sim', comparable: true, incompatibilities: [], changed, metrics, new_undesirable: fresh, candidates };
}
// @ts-expect-error augur-inject
compareBench = contract(compareBench, { ...augurContract_2b88a248, contractId: 'C-71', mode: 'observe', sample: 1, where: 'src/gate/compare-bench.ts:71', rule: 'contract-wrap', id: '2b88a248' }); /* augur-inject:contract-wrap:2b88a248 */
