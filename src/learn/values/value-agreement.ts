// Whether observed estimates agree with the canonical value: within AGREEMENT_TOLERANCE of it
// (relative, with an absolute floor for values near 0). Agreement is the share of runs whose
// estimate agrees, each run counted once (its mean estimate), so a long run cannot outvote
// several short ones (promotion.discoverable_requires counts player runs).

import type { ValueEstimate } from '../overlay/overlay.ts';
import { round3 } from '../stats/round.ts';

export const AGREEMENT_TOLERANCE = 0.05;
const ABSOLUTE_FLOOR = 1e-6;

export interface AgreementSummary {
  /** Distinct runs with an estimate. */
  readonly runs: number;
  readonly estimates: number;
  readonly mean: number;
  /** Share of runs whose mean estimate agrees with the canonical value (undefined without one). */
  readonly agreement?: number;
  /** Runs whose estimate agrees, in first-seen order. */
  readonly agreeing: readonly string[];
}

export function agrees(estimate: number, canonical: number): boolean {
  return Math.abs(estimate - canonical) <= Math.max(Math.abs(canonical) * AGREEMENT_TOLERANCE, ABSOLUTE_FLOOR);
}

function meanByRun(estimates: readonly ValueEstimate[]): Map<string, number> {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const { run, value } of estimates) {
    const current = sums.get(run) ?? { sum: 0, count: 0 };
    sums.set(run, { sum: current.sum + value, count: current.count + 1 });
  }
  return new Map([...sums].map(([run, { sum, count }]) => [run, sum / count]));
}

export function summarizeAgreement(estimates: readonly ValueEstimate[], canonical: number | undefined): AgreementSummary {
  const perRun = meanByRun(estimates);
  const mean = estimates.length === 0 ? 0 : estimates.reduce((sum, { value }) => sum + value, 0) / estimates.length;
  const agreeing = canonical === undefined ? [] : [...perRun].filter(([, value]) => agrees(value, canonical)).map(([run]) => run);
  return {
    runs: perRun.size,
    estimates: estimates.length,
    mean: round3(mean),
    ...(canonical === undefined || perRun.size === 0 ? {} : { agreement: round3(agreeing.length / perRun.size) }),
    agreeing,
  };
}
