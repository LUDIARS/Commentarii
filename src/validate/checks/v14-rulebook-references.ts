// V14: every name a rulebook expression uses is known - context functions, declared variables
// and sets, the $params its site binds, IDs that exist (with the right owner kind: hp(node:x) is
// an error) - and every non-expression reference resolves: assigned variables are declared for
// the owner they are assigned on, assignment / motion owners are self, actor, a declared $param
// or an existing ID, process rates change declared variables of the process owner.

import type { BundleIndex } from '@ludiars/commentarii-sdk/bundle';
import { unresolvedReason } from '@ludiars/commentarii-sdk/bundle';
import { checkExpression } from '@ludiars/commentarii-sdk/expression';
import { rulebookExpressions, rulebookScope } from '@ludiars/commentarii-sdk/rulebook';
import { ownersOf, type ActionDefinition, type Effect, type RulebookVariables, type VariableOwner } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';

class StructureChecker {
  readonly findings: Finding[] = [];

  constructor(
    private readonly index: BundleIndex,
    private readonly variables: RulebookVariables | undefined,
  ) {}

  private ownersOf(name: string): readonly VariableOwner[] | undefined {
    const declaration = this.variables?.variables[name];
    return declaration === undefined ? undefined : ownersOf(declaration);
  }

  /** self / actor, a declared $param, or an existing ID / node. */
  handle(path: string, pointer: string, text: string, params: ReadonlySet<string>): void {
    if (text === 'self' || text === 'actor') return;
    if (text.startsWith('$')) {
      if (!params.has(text.slice(1))) this.findings.push(error(path, pointer, `${text} is not a parameter here`));
      return;
    }
    const reason = unresolvedReason(this.index, text);
    if (reason !== undefined) this.findings.push(error(path, pointer, reason));
  }

  variable(path: string, pointer: string, name: string, owned: boolean): void {
    const owners = this.ownersOf(name);
    if (owners === undefined) {
      this.findings.push(error(path, pointer, `variable '${name}' is not declared in mechanics/variables.json`));
      return;
    }
    const perOwner = owners.some((owner) => owner === 'self' || owner === 'entity');
    if (owned && !perOwner) this.findings.push(error(path, pointer, `'${name}' belongs to the world / stage and takes no owner`));
    if (!owned && !owners.some((owner) => owner === 'world' || owner === 'stage')) this.findings.push(error(path, pointer, `'${name}' needs an owner (of)`));
  }

  effects(path: string, pointer: string, effects: readonly Effect[] | undefined, params: ReadonlySet<string>): void {
    effects?.forEach((effect, i) => {
      effect.outcomes.forEach((outcome, j) => {
        outcome.assign.forEach((assignment, k) => {
          const at = `${pointer}/${i}/outcomes/${j}/assign/${k}`;
          this.variable(path, `${at}/var`, assignment.var, assignment.of !== undefined);
          if (assignment.of !== undefined) this.handle(path, `${at}/of`, assignment.of, params);
        });
      });
    });
  }

  action(path: string, prefix: string, action: Partial<ActionDefinition>, params: ReadonlySet<string>): void {
    this.effects(path, `${prefix}/effects`, action.effects, params);
    if (action.motion?.goal !== undefined) this.handle(path, `${prefix}/motion/goal`, action.motion.goal, params);
    if (action.motion?.of !== undefined) this.handle(path, `${prefix}/motion/of`, action.motion.of, params);
    const kind = action.motion?.kind;
    if (kind?.startsWith('$') === true && !params.has(kind.slice(1))) this.findings.push(error(path, `${prefix}/motion/kind`, `${kind} is not a parameter here`));
    for (const name of Object.keys(action.cost ?? {})) this.variable(path, `${prefix}/cost/${name}`, name, true);
  }
}

function structureFindings(index: BundleIndex, load: Parameters<Check['run']>[0]['load']): Finding[] {
  const { rulebook } = load.bundle;
  const checker = new StructureChecker(index, rulebook.variables?.doc);
  const visible = new Map(rulebook.actions.map(({ doc }) => [doc.id, doc]));
  for (const { path, doc } of rulebook.actions) checker.action(path, '', doc, new Set(Object.keys(doc.params ?? {})));
  for (const { path, doc } of rulebook.maskedActions) {
    checker.action(path, '/override', doc.override, new Set(Object.keys(visible.get(doc.id)?.params ?? {})));
  }
  for (const { path, doc } of rulebook.processes) {
    doc.rate.forEach((rate, i) => checker.variable(path, `/rate/${i}/var`, rate.var, doc.of === 'self' || doc.of === 'entity'));
  }
  for (const { path, doc } of rulebook.behaviors) {
    if (doc.targeting !== undefined) checker.variable(path, '/targeting/var', doc.targeting.var, true);
  }
  if (rulebook.variables) {
    for (const [name, declaration] of Object.entries(rulebook.variables.doc.variables)) {
      if (declaration.machine !== undefined) checker.handle(rulebook.variables.path, `/variables/${name}/machine`, declaration.machine, new Set());
    }
  }
  return checker.findings;
}

export const v14RulebookReferences: Check = {
  id: 'V14',
  title: 'ルールブックの参照が解決する',
  run: ({ load, index }) => {
    const input = { ...(load.bundle.rulebook.variables ? { variables: load.bundle.rulebook.variables.doc } : {}), resolveId: (id: string) => unresolvedReason(index, id) };
    const findings: Finding[] = [];
    for (const expression of rulebookExpressions(load.bundle)) {
      for (const problem of checkExpression(expression.text, rulebookScope(input, expression))) {
        if (problem.kind === 'syntax') continue;
        findings.push(error(expression.path, expression.pointer, problem.message));
      }
    }
    return [...findings, ...structureFindings(index, load)];
  },
};
