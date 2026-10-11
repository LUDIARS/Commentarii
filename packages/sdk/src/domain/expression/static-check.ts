// Static check of an expression against what its document may refer to (design: Fable §3.3):
// unknown functions, variables, parameters and IDs, wrong argument counts, and arguments of the
// wrong kind (e.g. an owner-typed variable read off a map node). Never evaluates and never
// throws: a syntax error is one problem like the others.

import { ExpressionError } from './expression-error.ts';
import type { ExpressionLanguage } from './expression-language.ts';
import { parseExpression, type Expr } from './parse.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:cca9fdc4 */
import augurContract_9947fe96 from '../../contracts/check-expression.contract.ts'; /* augur-inject:contract-predicate:8306e425 */

export type ExpressionProblemKind = 'syntax' | 'unknown-function' | 'unknown-variable' | 'unknown-parameter' | 'unknown-id' | 'arity' | 'argument';

export interface ExpressionProblem {
  readonly kind: ExpressionProblemKind;
  readonly message: string;
}

export interface FunctionSignature {
  readonly minArgs: number;
  readonly maxArgs: number;
  /** Why the arguments do not fit (e.g. not an owner), or undefined. */
  readonly checkArguments?: (args: readonly Expr[]) => string | undefined;
}

export interface ExpressionScope {
  readonly language?: ExpressionLanguage;
  /** Bare names that are values (world / stage variables, `t`, `dt`). */
  readonly values: ReadonlySet<string>;
  /** Bare names that may only be context function arguments (`self`, `actor`, sets, variable names). */
  readonly symbols: ReadonlySet<string>;
  readonly functions: ReadonlyMap<string, FunctionSignature>;
  readonly params: ReadonlySet<string>;
  /** Why an ID token does not resolve, or undefined when it does. */
  readonly resolveId: (id: string) => string | undefined;
}

const BUILTIN_SIGNATURES: ReadonlyMap<string, FunctionSignature> = new Map([
  ['min', { minArgs: 1, maxArgs: Number.POSITIVE_INFINITY }],
  ['max', { minArgs: 1, maxArgs: Number.POSITIVE_INFINITY }],
  ['floor', { minArgs: 1, maxArgs: 1 }],
  ['ceil', { minArgs: 1, maxArgs: 1 }],
  ['abs', { minArgs: 1, maxArgs: 1 }],
  ['clamp', { minArgs: 3, maxArgs: 3 }],
  ['if', { minArgs: 3, maxArgs: 3 }],
]);

class Checker {
  readonly problems: ExpressionProblem[] = [];

  constructor(private readonly scope: ExpressionScope) {}

  private report(kind: ExpressionProblemKind, message: string): void {
    if (!this.problems.some((problem) => problem.message === message)) this.problems.push({ kind, message });
  }

  visit(node: Expr, asArgument = false): void {
    switch (node.type) {
      case 'number':
        return;
      case 'variable':
        if (this.scope.values.has(node.name) || (asArgument && this.scope.symbols.has(node.name))) return;
        this.report('unknown-variable', `unknown variable '${node.name}'`);
        return;
      case 'param':
        if (!this.scope.params.has(node.name)) this.report('unknown-parameter', `unknown parameter '$${node.name}'`);
        return;
      case 'id': {
        const reason = this.scope.resolveId(node.id);
        if (reason !== undefined) this.report('unknown-id', reason);
        return;
      }
      case 'unary':
      case 'not':
        this.visit(node.operand);
        return;
      case 'binary':
      case 'compare':
      case 'logical':
        this.visit(node.left);
        this.visit(node.right);
        return;
      case 'call':
        this.call(node.name, node.args);
    }
  }

  private call(name: string, args: readonly Expr[]): void {
    const builtin = BUILTIN_SIGNATURES.get(name);
    const signature = builtin ?? this.scope.functions.get(name);
    if (signature === undefined) {
      this.report('unknown-function', `unknown function '${name}'`);
    } else {
      if (args.length < signature.minArgs || args.length > signature.maxArgs) {
        this.report('arity', `${name}: wrong number of arguments (${args.length})`);
      }
      const reason = signature.checkArguments?.(args);
      if (reason !== undefined) this.report('argument', `${name}: ${reason}`);
    }
    for (const arg of args) this.visit(arg, builtin === undefined);
  }
}

export function checkExpression(source: string, scope: ExpressionScope): ExpressionProblem[] {
  let tree: Expr;
  try {
    tree = parseExpression(source, { language: scope.language ?? 'expr/2' });
  } catch (cause) {
    if (cause instanceof ExpressionError) return [{ kind: 'syntax', message: cause.message }];
    throw cause;
  }
  const checker = new Checker(scope);
  checker.visit(tree);
  return checker.problems;
}
// @ts-expect-error augur-inject
checkExpression = contract(checkExpression, { ...augurContract_9947fe96, contractId: 'C-101', mode: 'observe', sample: 1, where: 'packages/sdk/src/domain/expression/static-check.ts:102', rule: 'contract-wrap', id: '9947fe96' }); /* augur-inject:contract-wrap:9947fe96 */
