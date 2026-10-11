// The plug-in point of expr/2: what an evaluator is given besides the expression. The SDK
// owns the language; the meaning of `hp(x)`, `dist(a, b)`, `rule(id)`, `ready(id)`, `sum(set,
// var)` ... comes from whoever evaluates (Ingenium's belief, a validate check, a test), as a
// table of context functions. Symbols (bare names that are not variables, ID tokens and
// symbolic parameters such as an entity handle) reach the functions as strings.

import type { Interval } from './interval.ts';

/** A point value: a number, or a symbol (state, node, entity handle, ID). */
export type PointValue = number | string;

export type PointFunction = (args: readonly PointValue[]) => PointValue;

export interface PointContext {
  /** Bare names that are symbols (e.g. self, actor): they evaluate to themselves. */
  readonly symbols?: readonly string[];
  /** `$name` bindings: a number or a symbol. */
  readonly params?: Readonly<Record<string, PointValue>>;
  readonly functions?: Readonly<Record<string, PointFunction>>;
}

/** The symbols a value may be (one when known). Kept sorted and unique. */
export interface SymbolSet {
  readonly symbols: readonly string[];
}

export type IntervalValue = Interval | SymbolSet;

export type IntervalFunction = (args: readonly IntervalValue[]) => IntervalValue;

export interface IntervalContext {
  /** Bare names that are symbols (e.g. self, actor): they evaluate to themselves. */
  readonly symbols?: readonly string[];
  /** Bare names: a point or an interval. */
  readonly variables?: Readonly<Record<string, number | Interval>>;
  /** `$name` bindings: a number, an interval, a symbol or a set of possible symbols. */
  readonly params?: Readonly<Record<string, number | Interval | string | SymbolSet>>;
  readonly functions?: Readonly<Record<string, IntervalFunction>>;
}

export function symbolSet(...symbols: readonly string[]): SymbolSet {
  return { symbols: [...new Set(symbols)].sort() };
}

export function isSymbolSet(value: unknown): value is SymbolSet {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Array.isArray((value as SymbolSet).symbols);
}
