// The only functions a rule expression may call.

import { ExpressionError } from './expression-error.ts';

interface Builtin {
  readonly minArgs: number;
  readonly maxArgs: number;
  readonly apply: (args: readonly number[]) => number;
}

function at(args: readonly number[], index: number): number {
  const value = args[index];
  if (value === undefined) throw new ExpressionError(`missing argument ${index + 1}`);
  return value;
}

const BUILTINS: ReadonlyMap<string, Builtin> = new Map<string, Builtin>([
  ['min', { minArgs: 1, maxArgs: Number.POSITIVE_INFINITY, apply: (args) => Math.min(...args) }],
  ['max', { minArgs: 1, maxArgs: Number.POSITIVE_INFINITY, apply: (args) => Math.max(...args) }],
  ['floor', { minArgs: 1, maxArgs: 1, apply: (args) => Math.floor(at(args, 0)) }],
  ['ceil', { minArgs: 1, maxArgs: 1, apply: (args) => Math.ceil(at(args, 0)) }],
  ['abs', { minArgs: 1, maxArgs: 1, apply: (args) => Math.abs(at(args, 0)) }],
  [
    'clamp',
    {
      minArgs: 3,
      maxArgs: 3,
      apply: (args) => {
        const [value, low, high] = [at(args, 0), at(args, 1), at(args, 2)];
        if (low > high) throw new ExpressionError('clamp: lower bound is greater than upper bound');
        return Math.min(Math.max(value, low), high);
      },
    },
  ],
]);

export const BUILTIN_NAMES: readonly string[] = [...BUILTINS.keys()];

export function callBuiltin(name: string, args: readonly number[]): number {
  const builtin = BUILTINS.get(name);
  if (builtin === undefined) throw new ExpressionError(`unknown function '${name}'`);
  if (args.length < builtin.minArgs || args.length > builtin.maxArgs) {
    throw new ExpressionError(`${name}: wrong number of arguments (${args.length})`);
  }
  return builtin.apply(args);
}
