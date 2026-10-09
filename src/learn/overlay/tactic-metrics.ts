// A tactic's samples -> its measured metrics (design 4.4, tactic.schema.json metrics):
//   runs        judged runs (success + failure)
//   success     share of successes
//   time_sec    p50 / p90 of the time to success (absent without a success)
//   resource    per resource, the p50 spent per run
//   risk        damage_taken_p50: p50 of the damage taken per run (percent of the HP bar)

import type { TacticMetrics } from '../../domain/documents.ts';
import type { TacticSample } from './overlay.ts';
import { quantile } from '../stats/quantile.ts';
import { round3 } from '../stats/round.ts';

function resourceP50(samples: readonly TacticSample[]): Record<string, number> {
  const names = [...new Set(samples.flatMap((sample) => Object.keys(sample.resource)))].sort();
  return Object.fromEntries(names.map((name) => [name, quantile(samples.map((sample) => sample.resource[name] ?? 0), 0.5) ?? 0]));
}

export function tacticMetrics(samples: readonly TacticSample[]): TacticMetrics {
  const successes = samples.filter((sample) => sample.outcome === 'success');
  const times = successes.map((sample) => sample.time_sec);
  const p50 = quantile(times, 0.5);
  const p90 = quantile(times, 0.9);
  const resource = resourceP50(samples);
  const damage = quantile(samples.map((sample) => sample.damage_taken), 0.5);
  return {
    runs: samples.length,
    success: samples.length === 0 ? 0 : round3(successes.length / samples.length),
    ...(p50 === undefined || p90 === undefined ? {} : { time_sec: { p50, p90 } }),
    ...(Object.keys(resource).length === 0 ? {} : { resource }),
    ...(damage === undefined ? {} : { risk: { damage_taken_p50: damage } }),
  };
}
