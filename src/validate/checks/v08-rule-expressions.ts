// V08: every rule expression evaluates once with the example value of each variable, and each
// example lies inside its declared range.

import { evaluateExpression } from '../../domain/expression/evaluate-expression.ts';
import { error, type Check, type Finding } from '../check.ts';

export const v08RuleExpressions: Check = {
  id: 'V08',
  title: 'ルールの式が評価できる',
  run: ({ load }) => {
    const findings: Finding[] = [];
    for (const { path, doc } of load.bundle.rules) {
      const examples: Record<string, number> = {};
      for (const [name, variable] of Object.entries(doc.variables)) {
        const [low, high] = variable.range;
        if (low > high) findings.push(error(path, `/variables/${name}/range`, `range [${low}, ${high}] is reversed`));
        else if (variable.example < low || variable.example > high) {
          findings.push(error(path, `/variables/${name}/example`, `example ${variable.example} is outside [${low}, ${high}]`));
        }
        examples[name] = variable.example;
      }
      try {
        evaluateExpression(doc.expression, examples);
      } catch (cause) {
        findings.push(error(path, '/expression', `cannot evaluate: ${(cause as Error).message}`));
      }
    }
    return findings;
  },
};
