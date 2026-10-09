// 状態機械: Mermaid stateDiagram per machine.

import type { Bundle } from '../bundle/bundle.ts';
import type { StateMachine } from '../domain/documents.ts';
import { localize } from '../domain/localize.ts';
import { codeBlock, document } from '../markdown/markdown.ts';

function stateName(id: string): string {
  return id.replaceAll(/[^A-Za-z0-9_]/g, '_');
}

function renderMachine(machine: StateMachine): string {
  const lines = ['stateDiagram-v2', `  [*] --> ${stateName(machine.initial)}`];
  for (const state of machine.states) {
    if (state.label) lines.push(`  ${stateName(state.id)} : ${localize(state.label).replaceAll(':', '：')}`);
  }
  for (const transition of machine.transitions) {
    const rule = transition.rule ? ` (${transition.rule})` : '';
    lines.push(`  ${stateName(transition.from)} --> ${stateName(transition.to)} : ${`${transition.on}${rule}`.replaceAll(':', '：')}`);
  }
  const draft = machine.draft === true ? ' (draft)' : '';
  return document([
    `## ${localize(machine.name)} (${machine.id})${draft}`,
    `knowledge: ${machine.knowledge} / 出典: ${machine.source.kind} ${machine.source.ref}`,
    codeBlock('mermaid', lines.join('\n')),
  ]).trimEnd();
}

export function renderStates(bundle: Bundle): string {
  return document(['# 状態機械', ...(bundle.states.length === 0 ? ['状態機械はありません。'] : bundle.states.map(({ doc }) => renderMachine(doc)))]);
}
