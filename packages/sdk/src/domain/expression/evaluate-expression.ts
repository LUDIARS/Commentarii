// Evaluate an expression at one point (every input known). The result is always a finite
// number; anything else (unknown variable, division by zero, overflow, a symbol where a number
// is needed) is an ExpressionError. The expr/1 cases are unchanged; expr/2 adds comparisons and
// logic (1 = true, 0 = false, short-circuit), lazy `if(c, a, b)`, ID tokens, `$params` and the
// context functions of a PointContext.

import { BUILTIN_NAMES, callBuiltin } from './builtins.ts';
import type { PointContext, PointValue } from './evaluation-context.ts';
import { ExpressionError } from './expression-error.ts';
import { parseExpression, type Expr } from './parse.ts';
import type { ComparisonSymbol } from './tokenize.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:da37a26e */
import augurContract_a8102f52 from '../../contracts/evaluate-expression.contract.ts'; /* augur-inject:contract-predicate:22ed01a9 */

export type Variables = Readonly<Record<string, number>>;

function numberOf(value: PointValue, what: string): number {
  if (typeof value !== 'number') throw new ExpressionError(`${what} is the symbol '${value}', not a number`);
  return value;
}

function compareValues(op: ComparisonSymbol, left: PointValue, right: PointValue): boolean {
  if (op === '==' || op === '!=') {
    if (typeof left !== typeof right) throw new ExpressionError(`cannot compare '${String(left)}' with '${String(right)}'`);
    return (left === right) === (op === '==');
  }
  const [a, b] = [numberOf(left, 'left side'), numberOf(right, 'right side')];
  if (op === '<') return a < b;
  if (op === '<=') return a <= b;
  if (op === '>') return a > b;
  return a >= b;
}

class PointEvaluator {
  constructor(
    private readonly variables: Variables,
    private readonly context: PointContext,
  ) {}

  number(node: Expr): number {
    return numberOf(this.value(node), 'operand');
  }

  private truth(node: Expr): boolean {
    return this.number(node) !== 0;
  }

  value(node: Expr): PointValue {
    switch (node.type) {
      case 'number':
        return node.value;
      case 'variable': {
        if (!Object.hasOwn(this.variables, node.name) && this.context.symbols?.includes(node.name)) return node.name;
        if (!Object.hasOwn(this.variables, node.name)) throw new ExpressionError(`undefined variable '${node.name}'`);
        const value = this.variables[node.name];
        if (value === undefined || !Number.isFinite(value)) throw new ExpressionError(`variable '${node.name}' is not a finite number`);
        return value;
      }
      case 'unary': {
        const operand = this.number(node.operand);
        return node.op === '-' ? -operand : operand;
      }
      case 'binary': {
        const left = this.number(node.left);
        const right = this.number(node.right);
        if (node.op === '+') return left + right;
        if (node.op === '-') return left - right;
        if (node.op === '*') return left * right;
        if (right === 0) throw new ExpressionError('division by zero');
        return left / right;
      }
      case 'call':
        return this.call(node.name, node.args);
      case 'compare':
        return compareValues(node.op, this.value(node.left), this.value(node.right)) ? 1 : 0;
      case 'logical':
        if (node.op === '&&') return this.truth(node.left) && this.truth(node.right) ? 1 : 0;
        return this.truth(node.left) || this.truth(node.right) ? 1 : 0;
      case 'not':
        return this.truth(node.operand) ? 0 : 1;
      case 'id':
        return node.id;
      case 'param': {
        const params = this.context.params ?? {};
        if (!Object.hasOwn(params, node.name)) throw new ExpressionError(`unbound parameter '$${node.name}'`);
        return params[node.name] as PointValue;
      }
    }
  }

  /** A context function argument: a bare name that is not a variable is a symbol. */
  private argument(node: Expr): PointValue {
    if (node.type === 'variable' && !Object.hasOwn(this.variables, node.name)) return node.name;
    return this.value(node);
  }

  private call(name: string, args: readonly Expr[]): PointValue {
    if (name === 'if') {
      const [condition, then, otherwise] = args;
      if (args.length !== 3 || condition === undefined || then === undefined || otherwise === undefined) {
        throw new ExpressionError(`if: wrong number of arguments (${args.length})`);
      }
      return this.truth(condition) ? this.value(then) : this.value(otherwise);
    }
    const contextFunction = BUILTIN_NAMES.includes(name) ? undefined : this.context.functions?.[name];
    if (contextFunction === undefined) return callBuiltin(name, args.map((arg) => this.number(arg)));
    return contextFunction(args.map((arg) => this.argument(arg)));
  }
}

export function evaluateExpression(source: string, variables: Variables, context: PointContext = {}): number {
  const result = new PointEvaluator(variables, context).number(parseExpression(source));
  if (!Number.isFinite(result)) throw new ExpressionError('result is not a finite number');
  return result;
}
// @ts-expect-error augur-inject
evaluateExpression = contract(evaluateExpression, { ...augurContract_a8102f52, contractId: 'C-2', mode: 'observe', sample: 1, where: 'packages/sdk/src/domain/expression/evaluate-expression.ts:38', rule: 'contract-wrap', id: 'a8102f52' }); /* augur-inject:contract-wrap:a8102f52 */
