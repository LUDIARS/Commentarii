// C-101 checkExpression(source, scope): never throws; a text that does not parse yields exactly one
// syntax problem and nothing else; every problem has a message.

import type { ExpressionProblem } from '../domain/expression/static-check.ts';

export default {
  post: (problems: readonly ExpressionProblem[]) => {
    if (!Array.isArray(problems)) return 'result is not a list';
    if (problems.some((problem) => problem.message === '')) return 'a problem has no message';
    const syntax = problems.filter((problem) => problem.kind === 'syntax').length;
    return syntax === 0 || problems.length === 1 || 'a syntax problem came with other problems';
  },
  postThrow: () => 'checkExpression threw instead of reporting a problem',
};
