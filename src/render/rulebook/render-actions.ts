// ルールブックの行動の型: 一覧表と、行動ごとの式 (前提・持続・運動・効果).

import type { ActionDefinition, Effect } from '@ludiars/commentarii-sdk/types';
import { localize } from '@ludiars/commentarii-sdk/types';
import { codeBlock, document, table } from '../../markdown/markdown.ts';

function mapsTo(action: ActionDefinition): string {
  return action.maps_to === undefined ? '-' : JSON.stringify(action.maps_to);
}

function effectLines(effects: readonly Effect[]): string[] {
  return effects.flatMap((effect, i) => {
    const head = `effect ${i + 1} at ${effect.at}${effect.when === undefined ? '' : ` when ${effect.when}`}`;
    const outcomes = effect.outcomes.map((outcome) => {
      const assigns = outcome.assign.map((a) => `${a.of === undefined ? '' : `${a.of}.`}${a.var} := ${a.expr}`).join('; ');
      return `  p=${outcome.p}${outcome.label === undefined ? '' : ` (${outcome.label})`}: ${assigns || '変化なし'}`;
    });
    return [head, ...outcomes];
  });
}

function renderAction(action: ActionDefinition): string {
  const params = Object.entries(action.params ?? {}).map(([name, param]) => `$${name}: ${[param.kind].flat().join(' | ')}${param.where === undefined ? '' : ` where ${param.where}`}`);
  const lines = [
    `pre: ${action.pre}`,
    ...(action.duration === undefined ? [] : [`duration: ${action.duration}`]),
    ...(action.cooldown === undefined ? [] : [`cooldown: ${action.cooldown}`]),
    ...(action.motion === undefined ? [] : [`motion: ${action.motion.kind} ${action.motion.goal ?? ''} speed ${action.motion.speed}${action.motion.keep === undefined ? '' : ` keep ${action.motion.keep}`}`]),
    ...Object.entries(action.cost ?? {}).map(([name, amount]) => `cost: ${name} ${amount}`),
    ...effectLines(action.effects),
    ...(action.effects_known === false ? ['効果は未モデル化 (要実験)'] : []),
  ];
  const draft = action.draft === true ? ' (draft)' : '';
  return document([
    `### ${localize(action.name)} (${action.id})${draft}`,
    `actor: ${action.actor.join(', ')} / maps_to: ${mapsTo(action)} / knowledge: ${action.knowledge} / 出典: ${action.source.kind} ${action.source.ref}`,
    ...(params.length === 0 ? [] : [params.map((param) => `- ${param}`).join('\n')]),
    codeBlock('text', lines.join('\n')),
  ]).trimEnd();
}

export function renderActions(actions: readonly ActionDefinition[]): string {
  if (actions.length === 0) return document(['## 行動の型', '行動の型はありません。']).trimEnd();
  const rows = actions.map((action) => [action.id, localize(action.name), action.actor.join(', '), mapsTo(action), action.pre, action.knowledge]);
  return document(['## 行動の型', table(['行動', '名前', 'actor', 'maps_to', '前提 (pre)', 'knowledge'], rows), ...actions.map(renderAction)]).trimEnd();
}
