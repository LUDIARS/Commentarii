// V19: a behavior model refers to what exists: its state machine, an act entry per state of
// that machine (no act for a state the machine lacks), actions an entity can take, and only the
// parameters those actions declare - in act tables, timelines, trees, utility candidates and
// goap / mcts action lists alike.

import type { BundleIndex } from '@ludiars/commentarii-sdk/bundle';
import type { ActionCall, ActionDefinition, BehaviorModel, BehaviorTreeNode } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';

class BehaviorChecker {
  readonly findings: Finding[] = [];

  constructor(
    private readonly path: string,
    private readonly actions: ReadonlyMap<string, ActionDefinition>,
  ) {}

  action(pointer: string, id: string): ActionDefinition | undefined {
    const action = this.actions.get(id);
    if (action === undefined) this.findings.push(error(this.path, pointer, `${id} does not exist`));
    else if (!action.actor.includes('entity')) this.findings.push(error(this.path, pointer, `${id} cannot be taken by an entity (actor ${action.actor.join(', ')})`));
    return action;
  }

  call(pointer: string, call: ActionCall): void {
    const action = this.action(`${pointer}/action`, call.action);
    if (action === undefined) return;
    for (const name of Object.keys(call.params ?? {})) {
      if (!Object.hasOwn(action.params ?? {}, name)) this.findings.push(error(this.path, `${pointer}/params/${name}`, `${call.action} has no parameter '${name}'`));
    }
  }

  tree(pointer: string, node: BehaviorTreeNode | undefined): void {
    if (node === undefined) return;
    if (node.action !== undefined) this.call(pointer, { action: node.action, ...(node.params ? { params: node.params } : {}) });
    node.children?.forEach((child, i) => this.tree(`${pointer}/children/${i}`, child));
  }
}

function behaviorFindings(path: string, doc: BehaviorModel, index: BundleIndex, actions: ReadonlyMap<string, ActionDefinition>): Finding[] {
  const checker = new BehaviorChecker(path, actions);
  if (doc.machine !== undefined) {
    const states = index.subStates.get(doc.machine);
    if (states === undefined) checker.findings.push(error(path, '/machine', `${doc.machine} does not exist`));
    for (const state of Object.keys(doc.act ?? {})) {
      if (states !== undefined && !states.has(state)) checker.findings.push(error(path, `/act/${state}`, `${doc.machine} has no state '${state}'`));
    }
  }
  for (const [state, call] of Object.entries(doc.act ?? {})) checker.call(`/act/${state}`, call);
  doc.timeline?.forEach((step, i) => checker.call(`/timeline/${i}`, step));
  checker.tree('/tree', doc.tree);
  doc.candidates?.forEach((candidate, i) => checker.call(`/candidates/${i}`, candidate));
  doc.actions?.forEach((id, i) => checker.action(`/actions/${i}`, id));
  return checker.findings;
}

export const v19BehaviorReferences: Check = {
  id: 'V19',
  title: '挙動モデルの参照が切れていない',
  run: ({ load, index }) => {
    const actions = new Map(load.bundle.rulebook.actions.map(({ doc }) => [doc.id, doc]));
    return load.bundle.rulebook.behaviors.flatMap(({ path, doc }) => behaviorFindings(path, doc, index, actions));
  },
};
