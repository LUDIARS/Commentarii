// The built-in functions (builtins.ts) lifted to intervals. Each is monotone per argument
// (abs folds at 0), so the bounds are exact.

import { ExpressionError } from './expression-error.ts';
import type { Interval } from './interval.ts';

const ARITY: Readonly<Record<string, readonly [number, number]>> = {
  min: [1, Number.POSITIVE_INFINITY],
  max: [1, Number.POSITIVE_INFINITY],
  floor: [1, 1],
  ceil: [1, 1],
  abs: [1, 1],
  clamp: [3, 3],
};

function minOf(args: readonly Interval[]): Interval {
  return [Math.min(...args.map((a) => a[0])), Math.min(...args.map((a) => a[1]))];
}

function maxOf(args: readonly Interval[]): Interval {
  return [Math.max(...args.map((a) => a[0])), Math.max(...args.map((a) => a[1]))];
}

function absOf(a: Interval): Interval {
  if (a[0] >= 0) return a;
  if (a[1] <= 0) return [-a[1], -a[0]];
  return [0, Math.max(-a[0], a[1])];
}

function clampOf(value: Interval, low: Interval, high: Interval): Interval {
  if (low[0] > high[1]) throw new ExpressionError('clamp: lower bound is greater than upper bound');
  return minOf([maxOf([value, low]), high]);
}

function first(args: readonly Interval[], index: number): Interval {
  const value = args[index];
  if (value === undefined) throw new ExpressionError(`missing argument ${index + 1}`);
  return value;
}


export function callIntervalBuiltin(name: string, args: readonly Interval[]): Interval {
  const arity = ARITY[name];
  if (arity === undefined) throw new ExpressionError(`unknown function '${name}'`);
  if (args.length < arity[0] || args.length > arity[1]) throw new ExpressionError(`${name}: wrong number of arguments (${args.length})`);
  switch (name) {
    case 'min':
      return minOf(args);
    case 'max':
      return maxOf(args);
    case 'floor':
      return [Math.floor(first(args, 0)[0]), Math.floor(first(args, 0)[1])];
    case 'ceil':
      return [Math.ceil(first(args, 0)[0]), Math.ceil(first(args, 0)[1])];
    case 'abs':
      return absOf(first(args, 0));
    default:
      return clampOf(first(args, 0), first(args, 1), first(args, 2));
  }
}
