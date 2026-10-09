// guide gate balance (spec/feature/balance-gate.md §5): the balance comparison as a verdict for
// the Revisor review. With --fail-on block, an experience-block candidate fails the gate (exit 1);
// with --fail-on none it never fails on candidates. Results that cannot be compared always fail
// (exit 1): a gate that silently passes an apples-to-oranges comparison would be a false green.
// The verdict never says the experience was verified: the evidence is the sim.

import type { BalanceComparison } from './compare-bench.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:e8cb908d */
import augurContract_0111789e from '../contracts/gate-balance.contract.ts'; /* augur-inject:contract-predicate:31ee1466 */

export type FailOn = 'block' | 'none';

export type GateStatus = 'pass' | 'candidates' | 'incomparable';

export interface GateVerdict {
  readonly status: GateStatus;
  readonly fail: boolean;
  readonly comparison: BalanceComparison;
  /** What the verdict does not establish (always present). */
  readonly limits: readonly string[];
}

export const GATE_LIMITS: readonly string[] = [
  'evidence is the simulated game (sim), not the real build and not people',
  'a pass means no metric crossed its threshold on these seeds, not that the experience was verified',
  'decision regression (guide bench replay) is reported separately and never counts as a balance result',
];

export function gateBalance(comparison: BalanceComparison, failOn: FailOn): GateVerdict {
  if (!comparison.comparable) return { status: 'incomparable', fail: true, comparison, limits: GATE_LIMITS };
  const status: GateStatus = comparison.candidates.length > 0 ? 'candidates' : 'pass';
  return { status, fail: status === 'candidates' && failOn === 'block', comparison, limits: GATE_LIMITS };
}
// @ts-expect-error augur-inject
gateBalance = contract(gateBalance, { ...augurContract_0111789e, contractId: 'C-72', mode: 'observe', sample: 1, where: 'src/gate/gate-balance.ts:27', rule: 'contract-wrap', id: '0111789e' }); /* augur-inject:contract-wrap:0111789e */
