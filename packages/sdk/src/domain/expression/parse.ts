// Recursive-descent parser: expression -> AST. No code generation, no eval / Function.
//
//   expr    := term (('+' | '-') term)*
//   term    := unary (('*' | '/') unary)*
//   unary   := ('+' | '-') unary | primary
//   primary := number | identifier | identifier '(' expr (',' expr)* ')' | '(' expr ')'

import { ExpressionError } from './expression-error.ts';
import { tokenize, type Token } from './tokenize.ts';

export type Expr =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'variable'; readonly name: string }
  | { readonly type: 'unary'; readonly op: '+' | '-'; readonly operand: Expr }
  | { readonly type: 'binary'; readonly op: '+' | '-' | '*' | '/'; readonly left: Expr; readonly right: Expr }
  | { readonly type: 'call'; readonly name: string; readonly args: readonly Expr[] };

/** Nesting deeper than this is rejected so a hostile expression cannot exhaust the stack. */
export const MAX_NESTING_DEPTH = 64;

class Parser {
  private position = 0;
  private depth = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): Expr {
    if (this.tokens.length === 0) throw new ExpressionError('expression is empty');
    const expr = this.expression();
    const extra = this.peek();
    if (extra !== undefined) throw new ExpressionError(`unexpected token at ${extra.at}`);
    return expr;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private next(): Token {
    const token = this.tokens[this.position];
    if (token === undefined) throw new ExpressionError('unexpected end of expression');
    this.position += 1;
    return token;
  }

  private enter(): void {
    this.depth += 1;
    if (this.depth > MAX_NESTING_DEPTH) throw new ExpressionError(`expression nests deeper than ${MAX_NESTING_DEPTH}`);
  }

  private leave(): void {
    this.depth -= 1;
  }

  private expression(): Expr {
    this.enter();
    let left = this.term();
    for (let token = this.peek(); token?.type === 'operator' && (token.symbol === '+' || token.symbol === '-'); token = this.peek()) {
      this.next();
      left = { type: 'binary', op: token.symbol, left, right: this.term() };
    }
    this.leave();
    return left;
  }

  private term(): Expr {
    let left = this.unary();
    for (let token = this.peek(); token?.type === 'operator' && (token.symbol === '*' || token.symbol === '/'); token = this.peek()) {
      this.next();
      left = { type: 'binary', op: token.symbol, left, right: this.unary() };
    }
    return left;
  }

  private unary(): Expr {
    const token = this.peek();
    if (token?.type === 'operator' && (token.symbol === '+' || token.symbol === '-')) {
      this.next();
      this.enter();
      const operand = this.unary();
      this.leave();
      return { type: 'unary', op: token.symbol, operand };
    }
    return this.primary();
  }

  private primary(): Expr {
    const token = this.next();
    if (token.type === 'number') return { type: 'number', value: token.value };
    if (token.type === 'paren' && token.symbol === '(') {
      const inner = this.expression();
      this.expectClose();
      return inner;
    }
    if (token.type === 'identifier') {
      const following = this.peek();
      if (following?.type === 'paren' && following.symbol === '(') {
        this.next();
        return { type: 'call', name: token.name, args: this.arguments() };
      }
      return { type: 'variable', name: token.name };
    }
    throw new ExpressionError(`unexpected token at ${token.at}`);
  }

  private arguments(): Expr[] {
    const args: Expr[] = [this.expression()];
    while (this.peek()?.type === 'comma') {
      this.next();
      args.push(this.expression());
    }
    this.expectClose();
    return args;
  }

  private expectClose(): void {
    const token = this.next();
    if (token.type !== 'paren' || token.symbol !== ')') throw new ExpressionError(`expected ')' at ${token.at}`);
  }
}

export function parseExpression(source: string): Expr {
  return new Parser(tokenize(source)).parse();
}
