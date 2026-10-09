// Tokenizer of the rule expression language: numbers, identifiers, + - * / ( ) ,

import { ExpressionError } from './expression-error.ts';

export type Token =
  | { readonly type: 'number'; readonly value: number; readonly at: number }
  | { readonly type: 'identifier'; readonly name: string; readonly at: number }
  | { readonly type: 'operator'; readonly symbol: '+' | '-' | '*' | '/'; readonly at: number }
  | { readonly type: 'paren'; readonly symbol: '(' | ')'; readonly at: number }
  | { readonly type: 'comma'; readonly at: number };

/** Expressions longer than this are rejected before parsing (rules are short formulas). */
export const MAX_EXPRESSION_LENGTH = 1000;

const NUMBER = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*/;

export function tokenize(source: string): Token[] {
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
