// C-71 compareBench(base, head, thresholds): results whose comparability keys differ are refused
// with reasons and carry no metric or candidate; comparable results carry every metric, and the
// candidates are exactly the exceeded metrics plus the new undesirable divergences (if any).

import type { BenchResult } from '../bench/bench-result.ts';
import type { BalanceComparison } from '../gate/compare-bench.ts';

export default {
  post: (comparison: BalanceComparison, base: BenchResult, head: BenchResult) => {
    const keysDiffer = JSON.stringify(base.compatibility) !== JSON.stringify(head.compatibility) || base.game_id !== head.game_id;
    if (keysDiffer) {
      if (comparison.comparable) return 'results with different comparability keys were compared';
      return (comparison.metrics.length === 0 && comparison.candidates.length === 0 && comparison.incompatibilities.length > 0) || 'an incomparable result carries metrics or no reason';
    }
    if (!comparison.comparable) return 'comparable results were refused';
    const exceeded = comparison.metrics.filter((metric) => metric.exceeded).length;
    const divergence = comparison.new_undesirable.length > 0 && comparison.candidates.length === exceeded + 1 ? 1 : 0;
    return comparison.candidates.length === exceeded + divergence || `${comparison.candidates.length} candidates for ${exceeded} exceeded metrics`;
  },
};
