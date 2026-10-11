// C-100 evaluateInterval(source, context): a finite interval with lo <= hi, or an ExpressionError.

import type { Interval } from '../domain/expression/interval.ts';

export default {
  post: (result: Interval) => {
    if (!Array.isArray(result) || result.length !== 2) return 'result is not an interval';
    const [lo, hi] = result;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 'interval bound is not finite';
    return lo <= hi || 'interval is reversed';
  },
  postThrow: (error: unknown) => (error instanceof Error && error.name === 'ExpressionError') || 'failure is not an ExpressionError',
};
