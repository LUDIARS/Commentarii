// ルールブックの挙動モデル: fsm は Mermaid stateDiagram (遷移に when / p / hold、状態に act の
// 行動)、bt はインデント木、scripted は時刻表、utility / goap / mcts は記述の要約.

import type { ActionCall, BehaviorModel, BehaviorTreeNode, StateMachine } from '@ludiars/commentarii-sdk/types';
import { localize } from '@ludiars/commentarii-sdk/types';
import { codeBlock, document, table } from '../../markdown/markdown.ts';

function stateName(id: string): string {
  return id.replaceAll(/[^A-Za-z0-9_]/g, '_');
}

/** Mermaid labels end at ':'; ID tokens are written with the full-width colon instead. */
function label(text: string): string {
  return text.replaceAll(':', '：');
}

function call(entry: ActionCall): string {
  const params = Object.entries(entry.params ?? {}).map(([name, value]) => `${name}=${value}`);
  return params.length === 0 ? entry.action : `${entry.action}(${params.join(', ')})`;
}

export function fsmDiagram(behavior: BehaviorModel, machine: StateMachine | undefined): string {
  const lines = ['stateDiagram-v2'];
  if (machine === undefined) return codeBlock('mermaid', [...lines, `  note "${label(behavior.machine ?? '?')} がありません"`].join('\n'));
  lines.push(`  [*] --> ${stateName(machine.initial)}`);
  for (const state of machine.states) {
    const act = behavior.act?.[state.id];
    const parts = [state.label ? localize(state.label) : state.id, ...(act ? [call(act)] : [])];
    lines.push(`  ${stateName(state.id)} : ${label(parts.join(' / '))}`);
  }
  for (const transition of machine.transitions) {
    const condition = transition.when ?? transition.on;
    const extras = [transition.p === undefined ? '' : `p=${transition.p}`, transition.hold === undefined ? '' : `hold ${transition.hold}`].filter((part) => part !== '');
    lines.push(`  ${stateName(transition.from)} --> ${stateName(transition.to)} : ${label([condition, ...extras].join(' '))}`);
  }
  return codeBlock('mermaid', lines.join('\n'));
}

export function treeLines(node: BehaviorTreeNode, depth = 0): string[] {
  const indent = '  '.repeat(depth);
  const head =
    node.type === 'condition'
      ? `${indent}? ${node.pred ?? ''}`
      : node.type === 'action'
        ? `${indent}! ${call({ action: node.action ?? '?', ...(node.params ? { params: node.params } : {}) })}`
        : `${indent}${node.type}`;
  return [head, ...(node.children ?? []).flatMap((child) => treeLines(child, depth + 1))];
}

function body(behavior: BehaviorModel, machines: ReadonlyMap<string, StateMachine>): string[] {
  switch (behavior.paradigm) {
    case 'fsm':
      return [fsmDiagram(behavior, behavior.machine === undefined ? undefined : machines.get(behavior.machine))];
    case 'bt':
      return behavior.tree === undefined ? [] : [codeBlock('text', treeLines(behavior.tree).join('\n'))];
    case 'scripted':
      return [
        table(
          ['時刻 (s)', '行動'],
          (behavior.timeline ?? []).map((step) => [step.at, call(step)]),
        ),
        ...(behavior.loop === undefined ? [] : [`${behavior.loop} 秒ごとに繰り返す。`]),
      ];
    case 'utility':
      return [table(['候補', '考慮項目 (式 × 重み)'], (behavior.candidates ?? []).map((candidate) => [call(candidate), candidate.considerations.map((c) => `${c.expr} × ${c.weight}`).join('; ')]))];
    case 'goap':
      return [`目標: ${behavior.goal ?? '-'}${behavior.heuristic === undefined ? '' : ` / 推定: ${behavior.heuristic}`}`, `使える行動: ${(behavior.actions ?? []).join(', ')}`];
    case 'mcts':
      return [`探索: ${behavior.search?.iterations ?? '-'} 反復 / 深さ ${behavior.search?.depth ?? '-'}`, `使える行動: ${(behavior.actions ?? []).join(', ')}`];
  }
}

export function renderBehaviors(behaviors: readonly BehaviorModel[], states: readonly StateMachine[]): string {
  if (behaviors.length === 0) return document(['## 挙動モデル', '挙動モデルはありません。']).trimEnd();
  const machines = new Map(states.map((machine) => [machine.id, machine]));
  const sections = behaviors.map((behavior) =>
    document([
      `### ${behavior.name ? localize(behavior.name) : behavior.id} (${behavior.id})${behavior.draft === true ? ' (draft)' : ''}`,
      `方式: ${behavior.paradigm}${behavior.targeting ? ` / 標的 $${behavior.targeting.var} = ${behavior.targeting.pick}` : ''} / knowledge: ${behavior.knowledge} / 出典: ${behavior.source.kind} ${behavior.source.ref}`,
      ...body(behavior, machines),
    ]).trimEnd(),
  );
  return document(['## 挙動モデル', ...sections]).trimEnd();
}
