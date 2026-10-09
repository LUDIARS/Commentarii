// Quantiles of measured figures (design 4.4 metrics: time_sec p50 / p90): linear interpolation
// between the closest ranks of the sorted values, so p50 of an even count is the midpoint.

import { round3 } from './round.ts';

/** The q-quantile (0..1) of `values`, rounded; undefined for no values. */
export function quantile(values: readonly number[], q: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * Math.min(Math.max(q, 0), 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;
  return round3(low + (high - low) * (position - lower));
}
