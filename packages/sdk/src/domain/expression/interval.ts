// Interval arithmetic of expr/2 (design: Fable §2.4, §3.3). A value is [lo, hi]; a literal or
// an observed value is a point. Truth is an interval inside [0, 1]: [0,0] false, [1,1] true,
// [0,1] unknown, combined with Kleene's three-valued logic (&& = min, || = max, ! = 1 - x).
// Division by an interval that contains 0 is a model error, never folded into "unknown".

import { ExpressionError } from './expression-error.ts';
import type { ComparisonSymbol } from './tokenize.ts';

export type Interval = readonly [lo: number, hi: number];

export const TRUE: Interval = [1, 1];
export const FALSE: Interval = [0, 0];
export const UNKNOWN: Interval = [0, 1];

export function point(value: number): Interval {
  return [value, value];
}

export function isInterval(value: unknown): value is Interval {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

export function isPoint(value: Interval): boolean {
  return value[0] === value[1];
}

/** A well-formed finite interval, or an ExpressionError naming what was wrong. */
export function checkedInterval(value: Interval, what: string): Interval {
  const [lo, hi] = value;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new ExpressionError(`${what} is not a finite interval`);
  if (lo > hi) throw new ExpressionError(`${what} is a reversed interval [${lo}, ${hi}]`);
  return value;
}

export function hull(a: Interval, b: Interval): Interval {
  return [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
}

export function negate(a: Interval): Interval {
  return [-a[1], -a[0]];
}

export function add(a: Interval, b: Interval): Interval {
  return [a[0] + b[0], a[1] + b[1]];
}

export function subtract(a: Interval, b: Interval): Interval {
  return [a[0] - b[1], a[1] - b[0]];
}

function bounds(values: readonly number[]): Interval {
  return [Math.min(...values), Math.max(...values)];
}

export function multiply(a: Interval, b: Interval): Interval {
  if (isPoint(a) && isPoint(b)) return point(a[0] * b[0]);
  return bounds([a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]]);
}

export function divide(a: Interval, b: Interval): Interval {
  if (b[0] <= 0 && b[1] >= 0) throw new ExpressionError(isPoint(b) ? 'division by zero' : `division by an interval containing 0 [${b[0]}, ${b[1]}]`);
  if (isPoint(a) && isPoint(b)) return point(a[0] / b[0]);
  return bounds([a[0] / b[0], a[0] / b[1], a[1] / b[0], a[1] / b[1]]);
}

/** Any number as a truth value: 0 is false, a value that cannot be 0 is true, else unknown. */
export function truthOf(a: Interval): Interval {
  if (a[0] === 0 && a[1] === 0) return FALSE;
  if (a[0] > 0 || a[1] < 0) return TRUE;
  return UNKNOWN;
}

export function and(a: Interval, b: Interval): Interval {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1])];
}

export function or(a: Interval, b: Interval): Interval {
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

export function not(a: Interval): Interval {
  return [1 - a[1], 1 - a[0]];
}

function truth(holds: boolean, fails: boolean): Interval {
  if (holds) return TRUE;
  return fails ? FALSE : UNKNOWN;
}

export function compare(op: ComparisonSymbol, a: Interval, b: Interval): Interval {
  switch (op) {
    case '<':
      return truth(a[1] < b[0], a[0] >= b[1]);
    case '<=':
      return truth(a[1] <= b[0], a[0] > b[1]);
    case '>':
      return truth(a[0] > b[1], a[1] <= b[0]);
    case '>=':
      return truth(a[0] >= b[1], a[1] < b[0]);
    case '==':
      return truth(isPoint(a) && isPoint(b) && a[0] === b[0], a[1] < b[0] || b[1] < a[0]);
    case '!=':
      return not(compare('==', a, b));
  }
}
