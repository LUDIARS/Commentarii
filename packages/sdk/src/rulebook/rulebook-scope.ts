// The static-check scope of one rulebook expression (spec/feature/rulebook.md §1):
//   values     dt, world / stage variables (and, inside a variable declaration, every variable:
//              `derive: hp > 0` reads the same owner's hp)
//   symbols    self, actor, set names and variable names, as context function arguments only
//   functions  the context functions, each self / entity variable (`hp(x)`, x an owner) and
//              each set as a membership predicate (`hostile(x)`)
//   params     the `$name`s the expression's site binds
// IDs resolve through the caller (the bundle index).

import { isEntityKind, isNodeId, parseRef } from '../domain/id.ts';
import type { Expr } from '../domain/expression/parse.ts';
import type { ExpressionScope, FunctionSignature } from '../domain/expression/static-check.ts';
import { ownersOf, type RulebookVariables } from '../domain/rulebook-documents.ts';
import { BUILT_IN_OWNERS, BUILT_IN_VALUES, CONTEXT_FUNCTIONS, type ContextFunctionSpec } from './context-functions.ts';
import type { RulebookExpression } from './rulebook-expressions.ts';

export interface RulebookScopeInput {
  readonly variables?: RulebookVariables;
  /** Why an ID token does not resolve, or undefined. */
  readonly resolveId: (id: string) => string | undefined;
}

function describe(node: Expr | undefined): string {
  if (node === undefined) return 'nothing';
  if (node.type === 'variable') return node.name;
  if (node.type === 'id') return node.id;
  if (node.type === 'param') return `$${node.name}`;
  return 'an expression';
}

/** An owner is self / actor, a $param or an entity ID token. */
function ownerReason(node: Expr | undefined): string | undefined {
  if (node === undefined) return 'takes an owner';
  if (node.type === 'param') return undefined;
  if (node.type === 'variable' && BUILT_IN_OWNERS.includes(node.name)) return undefined;
  if (node.type === 'id' && !isNodeId(node.id)) {
    const kind = parseRef(node.id)?.kind;
    if (kind !== undefined && isEntityKind(kind)) return undefined;
  }
  return `takes an owner (self, actor, $param or an entity ID), not ${describe(node)}`;
}

function firstArgumentCheck(spec: ContextFunctionSpec, sets: ReadonlySet<string>, variables: ReadonlySet<string>): FunctionSignature['checkArguments'] {
  const isName = (node: Expr | undefined, names: ReadonlySet<string>): boolean => node?.type === 'variable' && names.has(node.name);
  switch (spec.first) {
    case 'owner':
      return (args) => ownerReason(args[0]);
    case 'rule':
      return (args) => (args[0]?.type === 'id' && parseRef(args[0].id)?.kind === 'rule' ? undefined : `takes a rule ID, not ${describe(args[0])}`);
    case 'set':
      return (args) => (isName(args[0], sets) ? undefined : `takes a declared set, not ${describe(args[0])}`);
    case 'variable':
      return (args) => (isName(args[0], variables) ? undefined : `takes a declared variable, not ${describe(args[0])}`);
    default:
      return undefined;
  }
}

export function rulebookScope(input: RulebookScopeInput, expression: Pick<RulebookExpression, 'params' | 'site'>): ExpressionScope {
  const declared = Object.entries(input.variables?.variables ?? {});
  const variableNames = new Set(declared.map(([name]) => name));
  const setNames = new Set(Object.keys(input.variables?.sets ?? {}));
  const bare = declared.filter(([, d]) => ownersOf(d).some((owner) => owner === 'world' || owner === 'stage')).map(([name]) => name);
  const values = new Set([...BUILT_IN_VALUES, ...BUILT_IN_OWNERS, ...(expression.site === 'declaration' ? variableNames : bare)]);

  const functions = new Map<string, FunctionSignature>();
  for (const spec of CONTEXT_FUNCTIONS) {
    const checkArguments = firstArgumentCheck(spec, setNames, variableNames);
    functions.set(spec.name, { minArgs: spec.minArgs, maxArgs: spec.maxArgs, ...(checkArguments ? { checkArguments } : {}) });
  }
  for (const [name, declaration] of declared) {
    if (!ownersOf(declaration).some((owner) => owner === 'self' || owner === 'entity')) continue;
    functions.set(name, { minArgs: 1, maxArgs: 1, checkArguments: (args) => ownerReason(args[0]) });
  }
  for (const name of setNames) functions.set(name, { minArgs: 1, maxArgs: 1, checkArguments: (args) => ownerReason(args[0]) });

  return {
    language: 'expr/2',
    values,
    symbols: new Set([...BUILT_IN_OWNERS, ...setNames, ...variableNames]),
    functions,
    params: new Set(expression.params),
    resolveId: input.resolveId,
  };
}
