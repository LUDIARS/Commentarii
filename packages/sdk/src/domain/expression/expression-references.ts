// What an expression refers to, without evaluating it: called functions, bare names,
// parameters and ID tokens. Used for knowledge propagation and for drawing a rulebook.

import { parseExpression, type Expr } from './parse.ts';

export interface ExpressionReferences {
  readonly functions: readonly string[];
  readonly names: readonly string[];
  readonly params: readonly string[];
  readonly ids: readonly string[];
}

/** References of a parsed tree, each list sorted and unique. */
export function referencesOf(tree: Expr): ExpressionReferences {
  const functions = new Set<string>();
  const names = new Set<string>();
  const params = new Set<string>();
  const ids = new Set<string>();
  const walk = (node: Expr): void => {
    switch (node.type) {
      case 'number':
        return;
      case 'variable':
        names.add(node.name);
        return;
      case 'param':
        params.add(node.name);
        return;
      case 'id':
        ids.add(node.id);
        return;
      case 'unary':
      case 'not':
        walk(node.operand);
        return;
      case 'binary':
      case 'compare':
      case 'logical':
        walk(node.left);
        walk(node.right);
        return;
      case 'call':
        functions.add(node.name);
        node.args.forEach(walk);
    }
  };
  walk(tree);
  const sorted = (set: Set<string>) => [...set].sort();
  return { functions: sorted(functions), names: sorted(names), params: sorted(params), ids: sorted(ids) };
}

/** References of an expression text; a text that does not parse refers to nothing. */
export function expressionReferences(source: string): ExpressionReferences {
  try {
    return referencesOf(parseExpression(source));
  } catch {
    return { functions: [], names: [], params: [], ids: [] };
  }
}
