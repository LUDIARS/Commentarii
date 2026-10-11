// ルールブックの目標 (勝敗条件と進捗尺度).

import type { Objectives } from '@ludiars/commentarii-sdk/types';
import { document, table } from '../../markdown/markdown.ts';

export function renderObjectives(objectives: Objectives | undefined): string {
  if (objectives === undefined) return document(['## 目標', '目標 (mechanics/objectives.json) はありません。']).trimEnd();
  const progress = (objectives.progress ?? []).map((measure) => [measure.id, measure.expr, measure.better === 'lower' ? '小さいほど良い' : '大きいほど良い', measure.scale ?? '-', measure.knowledge]);
  return document([
    '## 目標',
    table(['', '式'], [['勝ち (win)', objectives.win], ['負け (lose)', objectives.lose]]),
    `knowledge: ${objectives.knowledge} / 出典: ${objectives.source.kind} ${objectives.source.ref}`,
    ...(progress.length === 0 ? [] : ['### 進捗尺度', table(['尺度', '式', '向き', '正規化', 'knowledge'], progress)]),
  ]).trimEnd();
}
