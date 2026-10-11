// --knowledge full only: the masked section for internal review. Never part of player output.

import type { Bundle, GuideValue } from '@ludiars/commentarii-sdk/types';
import { findValueNodes, pointerToFieldPath } from '@ludiars/commentarii-sdk/types';
import { document, table } from '../markdown/markdown.ts';
import { formatValue } from './format-value.ts';

export function renderMasked(bundle: Bundle): string {
  const rows: string[][] = [];
  for (const { path, doc } of bundle.maskedEntities) {
    for (const { node, pointer } of findValueNodes(doc)) {
      const value = node as unknown as GuideValue;
      rows.push([doc.id, pointerToFieldPath(pointer), formatValue(value), `${value.source.kind} ${value.source.ref}`, path]);
    }
  }
  const overrides = bundle.rulebook.maskedActions.map(({ path, doc }) => [doc.id, Object.keys(doc.override).sort().join(', '), JSON.stringify(doc.override), `${doc.source.kind} ${doc.source.ref}`, path]);
  const maskedTactics = bundle.tactics.filter(({ doc }) => doc.knowledge === 'masked').map(({ doc }) => [doc.id]);
  return document([
    '# masked (内部用)',
    'この節は `--knowledge full` のときだけ生成される。公開・プレイヤー向けの資料に含めないこと。',
    '## masked の値',
    rows.length === 0 ? 'なし。' : table(['エンティティ', '項目', '値', '出典', 'ファイル'], rows),
    '## masked の行動の上書き',
    overrides.length === 0 ? 'なし。' : table(['行動', '上書きするキー', '真の定義', '出典', 'ファイル'], overrides),
    '## masked の定石',
    maskedTactics.length === 0 ? 'なし。' : table(['定石'], maskedTactics),
  ]);
}
