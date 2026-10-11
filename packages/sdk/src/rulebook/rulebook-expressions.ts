// Every expr/2 expression of a bundle's rulebook, with where it sits and what it may bind:
// variable declarations (range / init / derive), set filters, actions and their masked
// overrides, processes, behavior models, objectives and state machine transitions. validate
// (V13 syntax, V14 references, V18 knowledge) and render walk this one list.

import type { Bundle, Located } from '../bundle/bundle.ts';
import type { StateMachine } from '../domain/documents.ts';
import type {
  ActionDefinition,
  BehaviorModel,
  BehaviorTreeNode,
  Effect,
  MaskedActionOverride,
  Motion,
  Objectives,
  ProcessDefinition,
  RulebookVariables,
} from '../domain/rulebook-documents.ts';

export type ExpressionSite = 'declaration' | 'element';

export interface RulebookExpression {
  readonly path: string;
  /** JSON pointer of the expression inside its file. */
  readonly pointer: string;
  readonly text: string;
  /** ID of the element the expression belongs to (action, process, behavior, state machine), when it has one. */
  readonly owner?: string;
  /** `$name`s bound here. */
  readonly params: readonly string[];
  /** declaration: inside a variable declaration, where bare names are the same owner's variables. */
  readonly site: ExpressionSite;
}

type Push = (pointer: string, text: string | number | undefined) => void;

function pusher(list: RulebookExpression[], path: string, params: readonly string[], owner?: string, site: ExpressionSite = 'element'): Push {
  return (pointer, text) => {
    if (typeof text !== 'string') return;
    list.push({ path, pointer, text, params, site, ...(owner !== undefined ? { owner } : {}) });
  };
}

function variableExpressions(located: Located<RulebookVariables>, list: RulebookExpression[]): void {
  const { path, doc } = located;
  const declaration = pusher(list, path, [], undefined, 'declaration');
  for (const [name, variable] of Object.entries(doc.variables)) {
    variable.range?.forEach((bound, i) => declaration(`/variables/${name}/range/${i}`, bound));
    declaration(`/variables/${name}/init`, variable.init);
    declaration(`/variables/${name}/derive`, variable.derive);
  }
  for (const [name, set] of Object.entries(doc.sets ?? {})) pusher(list, path, ['e'])(`/sets/${name}/where`, set.where);
}

function motionExpressions(push: Push, pointer: string, motion: Motion | undefined): void {
  if (motion === undefined) return;
  push(`${pointer}/speed`, motion.speed);
  push(`${pointer}/keep`, motion.keep);
}

function effectExpressions(push: Push, pointer: string, effects: readonly Effect[] | undefined): void {
  effects?.forEach((effect, i) => {
    push(`${pointer}/${i}/when`, effect.when);
    effect.outcomes.forEach((outcome, j) => {
      outcome.assign.forEach((assignment, k) => push(`${pointer}/${i}/outcomes/${j}/assign/${k}/expr`, assignment.expr));
    });
  });
}

function overridableExpressions(push: Push, prefix: string, action: Partial<ActionDefinition>): void {
  push(`${prefix}/pre`, action.pre);
  push(`${prefix}/duration`, action.duration);
  push(`${prefix}/cooldown`, action.cooldown);
  for (const [name, amount] of Object.entries(action.cost ?? {})) push(`${prefix}/cost/${name}`, amount);
  motionExpressions(push, `${prefix}/motion`, action.motion);
  effectExpressions(push, `${prefix}/effects`, action.effects);
}

function actionExpressions({ path, doc }: Located<ActionDefinition>, list: RulebookExpression[]): void {
  const push = pusher(list, path, Object.keys(doc.params ?? {}), doc.id);
  for (const [name, param] of Object.entries(doc.params ?? {})) push(`/params/${name}/where`, param.where);
  overridableExpressions(push, '', doc);
}

function overrideExpressions({ path, doc }: Located<MaskedActionOverride>, visible: ActionDefinition | undefined, list: RulebookExpression[]): void {
  overridableExpressions(pusher(list, path, Object.keys(visible?.params ?? {}), doc.id), '/override', doc.override);
}

function processExpressions({ path, doc }: Located<ProcessDefinition>, list: RulebookExpression[]): void {
  const push = pusher(list, path, [], doc.id);
  push('/when', doc.when);
  doc.rate.forEach((rate, i) => push(`/rate/${i}/expr`, rate.expr));
}

function treeExpressions(push: Push, pointer: string, node: BehaviorTreeNode | undefined): void {
  if (node === undefined) return;
  push(`${pointer}/pred`, node.pred);
  node.children?.forEach((child, i) => treeExpressions(push, `${pointer}/children/${i}`, child));
}

function behaviorExpressions({ path, doc }: Located<BehaviorModel>, list: RulebookExpression[]): void {
  const push = pusher(list, path, doc.targeting ? [doc.targeting.var] : [], doc.id);
  push('/targeting/pick', doc.targeting?.pick);
  treeExpressions(push, '/tree', doc.tree);
  doc.candidates?.forEach((candidate, i) => {
    candidate.considerations.forEach((consideration, j) => push(`/candidates/${i}/considerations/${j}/expr`, consideration.expr));
  });
  push('/goal', doc.goal);
  push('/heuristic', doc.heuristic);
  push('/search/evaluate', doc.search?.evaluate);
}

function objectiveExpressions({ path, doc }: Located<Objectives>, list: RulebookExpression[]): void {
  const push = pusher(list, path, []);
  push('/win', doc.win);
  push('/lose', doc.lose);
  doc.progress?.forEach((measure, i) => {
    push(`/progress/${i}/expr`, measure.expr);
    push(`/progress/${i}/scale`, measure.scale);
  });
}

/** Transitions are evaluated for the machine's owner (actor) against its current target ($target). */
function transitionExpressions({ path, doc }: Located<StateMachine>, list: RulebookExpression[]): void {
  const push = pusher(list, path, ['target'], doc.id);
  doc.transitions.forEach((transition, i) => {
    push(`/transitions/${i}/when`, transition.when);
    push(`/transitions/${i}/hold`, transition.hold);
  });
}

export function rulebookExpressions(bundle: Bundle): RulebookExpression[] {
  const list: RulebookExpression[] = [];
  const { rulebook } = bundle;
  if (rulebook.variables) variableExpressions(rulebook.variables, list);
  for (const action of rulebook.actions) actionExpressions(action, list);
  const visible = new Map(rulebook.actions.map(({ doc }) => [doc.id, doc]));
  for (const override of rulebook.maskedActions) overrideExpressions(override, visible.get(override.doc.id), list);
  for (const process of rulebook.processes) processExpressions(process, list);
  for (const behavior of rulebook.behaviors) behaviorExpressions(behavior, list);
  if (rulebook.objectives) objectiveExpressions(rulebook.objectives, list);
  for (const machine of bundle.states) transitionExpressions(machine, list);
  return list;
}
