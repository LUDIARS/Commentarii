// Balance gate thresholds (spec/feature/balance-gate.md §3): manifest bench.thresholds over the
// defaults, field by field. A metric whose change goes past its threshold is an experience-block
// candidate; nothing else is.

import type { Manifest } from '../domain/documents.ts';

export interface BenchThresholds {
  /** Absolute drop of the clear rate (0.1 = 10 points). */
  readonly clear_rate_drop: number;
  /** Relative increase of the clear time p50 (0.2 = +20%). */
  readonly time_p50_increase: number;
  /** Relative increase of the clear time p90 (the slow tail a p50 can hide). */
  readonly time_p90_increase: number;
  /** Relative increase of the damage taken p50. */
  readonly damage_p50_increase: number;
  /** Undesirable divergences present in head and not in base (coverage benches). */
  readonly new_undesirable_divergence: number;
}

export const DEFAULT_BENCH_THRESHOLDS: BenchThresholds = {
  clear_rate_drop: 0.1,
  time_p50_increase: 0.2,
  time_p90_increase: 0.2,
  damage_p50_increase: 0.2,
  new_undesirable_divergence: 1,
};

export function benchThresholdsOf(manifest: Manifest | undefined): BenchThresholds {
  const declared = manifest?.bench?.thresholds ?? {};
  const pick = (key: keyof BenchThresholds): number => {
    const value = declared[key];
    return typeof value === 'number' ? value : DEFAULT_BENCH_THRESHOLDS[key];
  };
  return {
    clear_rate_drop: pick('clear_rate_drop'),
    time_p50_increase: pick('time_p50_increase'),
    time_p90_increase: pick('time_p90_increase'),
    damage_p50_increase: pick('damage_p50_increase'),
    new_undesirable_divergence: pick('new_undesirable_divergence'),
  };
}
