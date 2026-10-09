// C-72 gateBalance(comparison, failOn): an incomparable comparison always fails; otherwise the
// gate fails exactly when there are candidates and failOn is block; the limits are always stated.

import type { BalanceComparison } from '../gate/compare-bench.ts';
import type { FailOn, GateVerdict } from '../gate/gate-balance.ts';

export default {
  post: (verdict: GateVerdict, comparison: BalanceComparison, failOn: FailOn) => {
    if (verdict.limits.length === 0) return 'the verdict states no limits';
    if (!comparison.comparable) return (verdict.fail && verdict.status === 'incomparable') || 'an incomparable comparison did not fail';
    const expected = comparison.candidates.length > 0 && failOn === 'block';
    return verdict.fail === expected || `fail=${verdict.fail}, expected ${expected}`;
  },
};
