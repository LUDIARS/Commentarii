// Recursive-descent parser: expression -> AST. No code generation, no eval / Function.
//
//   expr    := or
//   or      := and ('||' and)*                                       expr/2
//   and     := not ('&&' not)*                                       expr/2
//   not     := '!' not | cmp                                         expr/2
//   cmp     := sum (('<' | '<=' | '==' | '!=' | '>=' | '>') sum)?    expr/2
//   sum     := term (('+' | '-') term)*
//   term    := unary (('*' | '/') unary)*
//   unary   := ('+' | '-') unary | primary
//   primary := number | identifier | identifier '(' expr (',' expr)* ')' | '(' expr ')'
//            | idtoken | '$' identifier                              expr/2
//
// expr/1 is the sum level alone, so an expr/1 text parses to the same tree under expr/2.
// `if(c, a, b)` is a call; evaluators treat it lazily.

import { ExpressionError } from './expression-error.ts';
import type { ExpressionLanguage } from './expression-language.ts';
import { tokenize, type ComparisonSymbol, type Token } from './tokenize.ts';

export type Expr =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'variable'; readonly name: string }
  | { readonly type: 'unary'; readonly op: '+' | '-'; readonly operand: Expr }
  | { readonly type: 'binary'; readonly op: '+' | '-' | '*' | '/'; readonly left: Expr; readonly right: Expr }
  | { readonly type: 'call'; readonly name: string; readonly args: readonly Expr[] }
  | { readonly type: 'compare'; readonly op: ComparisonSymbol; readonly left: Expr; readonly right: Expr }
  | { readonly type: 'logical'; readonly op: '&&' | '||'; readonly left: Expr; readonly right: Expr }
  | { readonly type: 'not'; readonly operand: Expr }
  | { readonly type: 'id'; readonly id: string }
  | { readonly type: 'param'; readonly name: string };

/** Nesting deeper than this is rejected so a hostile expression cannot exhaust the stack. */
export const MAX_NESTING_DEPTH = 64;

export interface ParseOptions {
  /** expr/2 unless the document says otherwise (rule documents are expr/1). */
  readonly language?: ExpressionLanguage;
}

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
    const expr = this.or();
    this.leave();
    return expr;
  }

  private or(): Expr {
    let left = this.and();
    for (let token = this.peek(); token?.type === 'logic' && token.symbol === '||'; token = this.peek()) {
      this.next();
      left = { type: 'logical', op: '||', left, right: this.and() };
    }
    return left;
  }

  private and(): Expr {
    let left = this.not();
    for (let token = this.peek(); token?.type === 'logic' && token.symbol === '&&'; token = this.peek()) {
      this.next();
      left = { type: 'logical', op: '&&', left, right: this.not() };
    }
    return left;
  }

  private not(): Expr {
    const token = this.peek();
    if (token?.type === 'logic' && token.symbol === '!') {
      this.next();
      this.enter();
      const operand = this.not();
      this.leave();
      return { type: 'not', operand };
    }
    return this.comparison();
  }

  private comparison(): Expr {
    const left = this.sum();
    const token = this.peek();
    if (token?.type !== 'comparison') return left;
    this.next();
    return { type: 'compare', op: token.symbol, left, right: this.sum() };
  }

  private sum(): Expr {
    let left = this.term();
    for (let token = this.peek(); token?.type === 'operator' && (token.symbol === '+' || token.symbol === '-'); token = this.peek()) {
      this.next();
      left = { type: 'binary', op: token.symbol, left, right: this.term() };
    }
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
    if (token.type === 'id') return { type: 'id', id: token.id };
    if (token.type === 'param') return { type: 'param', name: token.name };
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

export function parseExpression(source: string, options: ParseOptions = {}): Expr {
  return new Parser(tokenize(source, options.language ?? 'expr/2')).parse();
}
