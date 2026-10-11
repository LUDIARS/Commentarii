// Evaluate a rule expression against variable values. The result is always a finite number;
// anything else (unknown variable, division by zero, overflow) is an ExpressionError.

import { callBuiltin } from './builtins.ts';
import { ExpressionError } from './expression-error.ts';
import { parseExpression, type Expr } from './parse.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:da37a26e */
import augurContract_a8102f52 from '../../contracts/evaluate-expression.contract.ts'; /* augur-inject:contract-predicate:22ed01a9 */

export type Variables = Readonly<Record<string, number>>;

function evaluateNode(node: Expr, variables: Variables): number {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'variable': {
      if (!Object.hasOwn(variables, node.name)) throw new ExpressionError(`undefined variable '${node.name}'`);
      const value = variables[node.name];
      if (value === undefined || !Number.isFinite(value)) throw new ExpressionError(`variable '${node.name}' is not a finite number`);
      return value;
    }
    case 'unary': {
      const operand = evaluateNode(node.operand, variables);
      return node.op === '-' ? -operand : operand;
    }
    case 'binary': {
      const left = evaluateNode(node.left, variables);
      const right = evaluateNode(node.right, variables);
      if (node.op === '+') return left + right;
      if (node.op === '-') return left - right;
      if (node.op === '*') return left * right;
      if (right === 0) throw new ExpressionError('division by zero');
      return left / right;
    }
    case 'call':
      return callBuiltin(node.name, node.args.map((arg) => evaluateNode(arg, variables)));
  }
}

export function evaluateExpression(source: string, variables: Variables): number {
  const result = evaluateNode(parseExpression(source), variables);
  if (!Number.isFinite(result)) throw new ExpressionError('result is not a finite number');
  return result;
}
// @ts-expect-error augur-inject
evaluateExpression = contract(evaluateExpression, { ...augurContract_a8102f52, contractId: 'C-2', mode: 'observe', sample: 1, where: 'packages/sdk/src/domain/expression/evaluate-expression.ts:38', rule: 'contract-wrap', id: 'a8102f52' }); /* augur-inject:contract-wrap:a8102f52 */
