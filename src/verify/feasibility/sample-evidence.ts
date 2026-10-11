// The measured evidence behind a band (Astra review P1-3, spec/feature/intent-verify.md 6.2):
// how many finished attempts tried the solution, how many succeeded, the success rate with its
// 95% Wilson score interval, the seeds and the tick budgets of those runs, and how many attempts
// were cut short (aborted runs: tick limit or error, which are no evidence either way). A rate
// without its sample size would let "0 of 2" read like "cannot be done".

import { contract } from '#contract-runtime'; /* augur-inject:import:fc8a3037 */
import augurContract_5b3a7534 from '../../contracts/sample-evidence.contract.ts'; /* augur-inject:contract-predicate:d3c2a801 */

const Z95 = 1.959964;

export interface SampleEvidence {
  /** Finished attempts (the denominator). */
  readonly attempts: number;
  readonly successes: number;
  /** null without attempts. */
  readonly success_rate: number | null;
  /** 95% Wilson score interval of the success rate; null without attempts. */
  readonly interval: readonly [number, number] | null;
  /** Attempts of runs that were aborted (not in the denominator). */
  readonly aborted: number;
  readonly seeds: readonly (number | string)[];
  /** Largest tick count a run of the sample used (its recorded budget). */
  readonly budget_ticks: number;
}

interface Attempt {
  readonly reached: boolean;
  readonly completed: boolean;
  readonly seed: number | string;
  readonly runTicks: number;
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** 95% Wilson score interval of successes / attempts. */
export function wilsonInterval(successes: number, attempts: number): readonly [number, number] | null {
  if (attempts === 0) return null;
  const p = successes / attempts;
  const z2 = Z95 * Z95;
  const centre = (p + z2 / (2 * attempts)) / (1 + z2 / attempts);
  const half = (Z95 * Math.sqrt((p * (1 - p)) / attempts + z2 / (4 * attempts * attempts))) / (1 + z2 / attempts);
  return [round(Math.max(0, centre - half)), round(Math.min(1, centre + half))];
}

export function sampleEvidence(members: readonly Attempt[]): SampleEvidence {
  const finished = members.filter((member) => member.completed);
  const successes = finished.filter((member) => member.reached).length;
  const seeds = [...new Set(finished.map((member) => member.seed))].sort((a, b) => String(a).localeCompare(String(b), 'en', { numeric: true }));
  return {
    attempts: finished.length,
    successes,
    success_rate: finished.length === 0 ? null : round(successes / finished.length),
    interval: wilsonInterval(successes, finished.length),
    aborted: members.length - finished.length,
    seeds,
    budget_ticks: Math.max(0, ...members.map((member) => member.runTicks)),
  };
}
// @ts-expect-error augur-inject
sampleEvidence = contract(sampleEvidence, { ...augurContract_5b3a7534, contractId: 'C-68', mode: 'observe', sample: 1, where: 'src/verify/feasibility/sample-evidence.ts:45', rule: 'contract-wrap', id: '5b3a7534' }); /* augur-inject:contract-wrap:5b3a7534 */
