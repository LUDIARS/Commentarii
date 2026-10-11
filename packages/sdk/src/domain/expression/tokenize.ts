// Tokenizer of the guide expression language. expr/1 has numbers, identifiers, + - * / ( ) ,
// expr/2 adds comparisons (< <= == != >= >), logic (&& || !), parameters ($x) and ID tokens
// (kind:game:slug[#state], node:slug) read as one token. There are no string literals.
// An expr/1 text tokenizes to the same tokens under both versions.

import { ExpressionError } from './expression-error.ts';
import type { ExpressionLanguage } from './expression-language.ts';

export type ComparisonSymbol = '<' | '<=' | '==' | '!=' | '>=' | '>';

export type Token =
  | { readonly type: 'number'; readonly value: number; readonly at: number }
  | { readonly type: 'identifier'; readonly name: string; readonly at: number }
  | { readonly type: 'operator'; readonly symbol: '+' | '-' | '*' | '/'; readonly at: number }
  | { readonly type: 'paren'; readonly symbol: '(' | ')'; readonly at: number }
  | { readonly type: 'comma'; readonly at: number }
  | { readonly type: 'comparison'; readonly symbol: ComparisonSymbol; readonly at: number }
  | { readonly type: 'logic'; readonly symbol: '&&' | '||' | '!'; readonly at: number }
  | { readonly type: 'param'; readonly name: string; readonly at: number }
  | { readonly type: 'id'; readonly id: string; readonly at: number };

/** Expressions longer than this are rejected before parsing (rules are short formulas). */
export const MAX_EXPRESSION_LENGTH = 1000;

const NUMBER = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/;
/** kind:segment(:segment)*(#state): an identifier directly followed by ':' starts one. */
const ID_TOKEN = /^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9_-]*)+(?:#[a-z0-9][a-z0-9_-]*)?/;
const PARAM = /^\$([A-Za-z_][A-Za-z0-9_]*)/;
const COMPARISONS: readonly ComparisonSymbol[] = ['<=', '>=', '==', '!=', '<', '>'];

function v2Token(rest: string, at: number): { token: Token; length: number } | undefined {
  const id = ID_TOKEN.exec(rest);
  if (id) return { token: { type: 'id', id: id[0], at }, length: id[0].length };
  const param = PARAM.exec(rest);
  if (param) return { token: { type: 'param', name: param[1] ?? '', at }, length: param[0].length };
  for (const symbol of ['&&', '||'] as const) {
    if (rest.startsWith(symbol)) return { token: { type: 'logic', symbol, at }, length: 2 };
  }
  const comparison = COMPARISONS.find((symbol) => rest.startsWith(symbol));
  if (comparison) return { token: { type: 'comparison', symbol: comparison, at }, length: comparison.length };
  if (rest.startsWith('!')) return { token: { type: 'logic', symbol: '!', at }, length: 1 };
  return undefined;
}

export function tokenize(source: string, language: ExpressionLanguage = 'expr/2'): Token[] {
  if (source.length > MAX_EXPRESSION_LENGTH) {
    throw new ExpressionError(`expression is longer than ${MAX_EXPRESSION_LENGTH} characters`);
  }
  const tokens: Token[] = [];
  let at = 0;
  while (at < source.length) {
    const char = source.charAt(at);
    if (/\s/.test(char)) {
      at += 1;
      continue;
    }
    const rest = source.slice(at);
    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]), at });
      at += number[0].length;
      continue;
    }
    const extended = language === 'expr/2' ? v2Token(rest, at) : undefined;
    if (extended) {
      tokens.push(extended.token);
      at += extended.length;
      continue;
    }
    const identifier = IDENTIFIER.exec(rest);
    if (identifier) {
      tokens.push({ type: 'identifier', name: identifier[0], at });
      at += identifier[0].length;
      continue;
    }
    if (char === '+' || char === '-' || char === '*' || char === '/') {
      tokens.push({ type: 'operator', symbol: char, at });
    } else if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', symbol: char, at });
    } else if (char === ',') {
      tokens.push({ type: 'comma', at });
    } else {
      throw new ExpressionError(`unexpected character '${char}' at ${at}`);
    }
    at += 1;
  }
  return tokens;
}
