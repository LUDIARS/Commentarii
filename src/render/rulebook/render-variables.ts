// ルールブックの変数表と集合 (mechanics/variables.json).

import type { Bound, RulebookVariables, VariableDeclaration } from '@ludiars/commentarii-sdk/types';
import { localize, ownersOf } from '@ludiars/commentarii-sdk/types';
import { document, table } from '../../markdown/markdown.ts';

function bounds(range: readonly [Bound, Bound] | undefined): string {
  return range === undefined ? '-' : `${range[0]} 〜 ${range[1]}`;
}

function observed(declaration: VariableDeclaration): string {
  if (declaration.observe === undefined) return declaration.derive === undefined ? '予測のみ' : '導出';
  if (typeof declaration.observe === 'string') return declaration.observe;
  return Object.entries(declaration.observe)
    .map(([owner, rule]) => `${owner}: ${rule}`)
    .join(' / ');
}

function origin(declaration: VariableDeclaration): string {
  const parts = [
    declaration.from === undefined ? '' : `from ${declaration.from}`,
    declaration.init === undefined ? '' : `init ${declaration.init}`,
    declaration.derive === undefined ? '' : `derive ${declaration.derive}`,
  ];
  return parts.filter((part) => part !== '').join(' / ') || '-';
}

export function renderVariables(variables: RulebookVariables | undefined): string {
  if (variables === undefined) return document(['## 変数', '変数の宣言 (mechanics/variables.json) はありません。']).trimEnd();
  const rows = Object.entries(variables.variables).map(([name, declaration]) => [
    name,
    ownersOf(declaration).join(', '),
    declaration.type,
    declaration.unit ?? '-',
    bounds(declaration.range),
    observed(declaration),
    origin(declaration),
    declaration.knowledge,
    localize(declaration.description) || '-',
  ]);
  const sets = Object.entries(variables.sets ?? {}).map(([name, set]) => [name, set.where, set.knowledge, localize(set.description) || '-']);
  return document([
    '## 変数',
    table(['変数', '所有者', '型', '単位', '値域', '観測', '初期値・導出', 'knowledge', '説明'], rows),
    ...(sets.length === 0 ? [] : ['### 集合', table(['集合', '条件', 'knowledge', '説明'], sets)]),
  ]).trimEnd();
}
