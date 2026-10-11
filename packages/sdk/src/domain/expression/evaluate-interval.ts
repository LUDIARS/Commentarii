// Interval evaluation of expr/2 (design: Fable §3.3). Every value is [lo, hi] (or a set of
// possible symbols); unknowns widen the result instead of failing. Truth values live in [0, 1]:
// `a < b` is true when a.hi < b.lo, false when a.lo >= b.hi, otherwise unknown; && / || / !
// are min / max / 1 - x and short-circuit on a decided left side; `if(c, a, b)` with an
// unknown c is the hull of both branches. Model errors (division by an interval containing 0,
// unknown names, a symbol used as a number) stay ExpressionErrors.

import { BUILTIN_NAMES } from './builtins.ts';
import { isSymbolSet, symbolSet, type IntervalContext, type IntervalValue, type SymbolSet } from './evaluation-context.ts';
import { ExpressionError } from './expression-error.ts';
import {
  add,
  and,
  checkedInterval,
  compare,
  divide,
  FALSE,
  hull,
  isInterval,
  multiply,
  negate,
  not,
  or,
  point,
  subtract,
  TRUE,
  truthOf,
  UNKNOWN,
  type Interval,
} from './interval.ts';
import { callIntervalBuiltin } from './interval-builtins.ts';
import { parseExpression, type Expr } from './parse.ts';
import type { ComparisonSymbol } from './tokenize.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:6004ba2b */
import augurContract_8a1e5848 from '../../contracts/evaluate-interval.contract.ts'; /* augur-inject:contract-predicate:16ac992f */

function sameTruth(a: Interval, b: Interval): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function compareSymbols(op: ComparisonSymbol, a: SymbolSet, b: SymbolSet): Interval {
  if (op !== '==' && op !== '!=') throw new ExpressionError(`'${op}' cannot order symbols`);
  const [onlyA, onlyB] = [a.symbols[0], b.symbols[0]];
  let equal: Interval = UNKNOWN;
  if (a.symbols.length === 1 && b.symbols.length === 1 && onlyA === onlyB) equal = TRUE;
  else if (!a.symbols.some((symbol) => b.symbols.includes(symbol))) equal = FALSE;
  return op === '==' ? equal : not(equal);
}

function joinValues(a: IntervalValue, b: IntervalValue): IntervalValue {
  if (isInterval(a) && isInterval(b)) return hull(a, b);
  if (isSymbolSet(a) && isSymbolSet(b)) return symbolSet(...a.symbols, ...b.symbols);
  throw new ExpressionError('if: one branch is a number and the other a symbol');
}

class IntervalEvaluator {
  constructor(private readonly context: IntervalContext) {}

  interval(node: Expr): Interval {
    const value = this.value(node);
    if (!isInterval(value)) throw new ExpressionError(`the symbol ${value.symbols.join(' | ')} is not a number`);
    return value;
  }

  private truth(node: Expr): Interval {
    return truthOf(this.interval(node));
  }

  value(node: Expr): IntervalValue {
    switch (node.type) {
      case 'number':
        return point(node.value);
      case 'variable':
        if (!Object.hasOwn(this.context.variables ?? {}, node.name) && this.context.symbols?.includes(node.name)) return symbolSet(node.name);
        return this.variable(node.name);
      case 'unary': {
        const operand = this.interval(node.operand);
        return node.op === '-' ? negate(operand) : operand;
      }
      case 'binary': {
        const left = this.interval(node.left);
        const right = this.interval(node.right);
        if (node.op === '+') return add(left, right);
        if (node.op === '-') return subtract(left, right);
        if (node.op === '*') return multiply(left, right);
        return divide(left, right);
      }
      case 'call':
        return this.call(node.name, node.args);
      case 'compare': {
        const [left, right] = [this.value(node.left), this.value(node.right)];
        if (isInterval(left) && isInterval(right)) return compare(node.op, left, right);
        if (isSymbolSet(left) && isSymbolSet(right)) return compareSymbols(node.op, left, right);
        throw new ExpressionError('cannot compare a number with a symbol');
      }
      case 'logical': {
        const left = this.truth(node.left);
        if (node.op === '&&') return sameTruth(left, FALSE) ? FALSE : and(left, this.truth(node.right));
        return sameTruth(left, TRUE) ? TRUE : or(left, this.truth(node.right));
      }
      case 'not':
        return not(this.truth(node.operand));
      case 'id':
        return symbolSet(node.id);
      case 'param':
        return this.param(node.name);
    }
  }

  private variable(name: string): Interval {
    const variables = this.context.variables ?? {};
    if (!Object.hasOwn(variables, name)) throw new ExpressionError(`undefined variable '${name}'`);
    const value = variables[name] as number | Interval;
    return checkedInterval(typeof value === 'number' ? point(value) : value, `variable '${name}'`);
  }

  private param(name: string): IntervalValue {
    const params = this.context.params ?? {};
    if (!Object.hasOwn(params, name)) throw new ExpressionError(`unbound parameter '$${name}'`);
    const value = params[name];
    if (typeof value === 'number') return point(value);
    if (typeof value === 'string') return symbolSet(value);
    if (value === undefined) throw new ExpressionError(`unbound parameter '$${name}'`);
    return isInterval(value) ? checkedInterval(value, `parameter '$${name}'`) : value;
  }

  private argument(node: Expr): IntervalValue {
    if (node.type === 'variable' && !Object.hasOwn(this.context.variables ?? {}, node.name)) return symbolSet(node.name);
    return this.value(node);
  }

  private call(name: string, args: readonly Expr[]): IntervalValue {
    if (name === 'if') {
      const [condition, then, otherwise] = args;
      if (args.length !== 3 || condition === undefined || then === undefined || otherwise === undefined) {
        throw new ExpressionError(`if: wrong number of arguments (${args.length})`);
      }
      const truth = this.truth(condition);
      if (sameTruth(truth, TRUE)) return this.value(then);
      if (sameTruth(truth, FALSE)) return this.value(otherwise);
      return joinValues(this.value(then), this.value(otherwise));
    }
    const contextFunction = BUILTIN_NAMES.includes(name) ? undefined : this.context.functions?.[name];
    if (contextFunction === undefined) return callIntervalBuiltin(name, args.map((arg) => this.interval(arg)));
    const result = contextFunction(args.map((arg) => this.argument(arg)));
    return isInterval(result) ? checkedInterval(result, `${name}(...)`) : result;
  }
}

/** The value of an expression as an interval; a symbol at the top is an ExpressionError. */
export function evaluateInterval(source: string | Expr, context: IntervalContext = {}): Interval {
  const tree = typeof source === 'string' ? parseExpression(source) : source;
  return checkedInterval(new IntervalEvaluator(context).interval(tree), 'result');
}
// @ts-expect-error augur-inject
evaluateInterval = contract(evaluateInterval, { ...augurContract_8a1e5848, contractId: 'C-100', mode: 'observe', sample: 1, where: 'packages/sdk/src/domain/expression/evaluate-interval.ts:149', rule: 'contract-wrap', id: '8a1e5848' }); /* augur-inject:contract-wrap:8a1e5848 */

/** The value of an expression, which may be a set of possible symbols (a state, a node). */
export function evaluateIntervalValue(source: string | Expr, context: IntervalContext = {}): IntervalValue {
  const tree = typeof source === 'string' ? parseExpression(source) : source;
  const value = new IntervalEvaluator(context).value(tree);
  return isInterval(value) ? checkedInterval(value, 'result') : value;
}
