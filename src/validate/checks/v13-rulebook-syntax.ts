// V13: every rulebook expression (variables, actions and their masked overrides, processes,
// behaviors, objectives, state machine transitions) parses as expr/2.

import { ExpressionError, parseExpression } from '@ludiars/commentarii-sdk/expression';
import { rulebookExpressions } from '@ludiars/commentarii-sdk/rulebook';
import { error, type Check, type Finding } from '../check.ts';

export const v13RulebookSyntax: Check = {
  id: 'V13',
  title: 'ルールブックの式が構文どおり',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const expression of rulebookExpressions(load.bundle)) {
      try {
        parseExpression(expression.text);
      } catch (cause) {
        if (!(cause instanceof ExpressionError)) throw cause;
        findings.push(error(expression.path, expression.pointer, `cannot parse '${expression.text}': ${cause.message}`));
      }
    }
    return findings;
  },
};
