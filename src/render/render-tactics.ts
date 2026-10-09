// 定石一覧 (実測つき) and the steps of each tactic.

import type { Bundle } from '../bundle/bundle.ts';
import type { Tactic } from '../domain/documents.ts';
import { localize } from '../domain/localize.ts';
import { codeBlock, document, percent, table } from '../markdown/markdown.ts';

function metricsCells(tactic: Tactic): string[] {
  const metrics = tactic.metrics;
  if (metrics === undefined) return ['-', '-', '-'];
  return [String(metrics.runs), percent(metrics.success), metrics.time_sec?.p50 === undefined ? '-' : `${metrics.time_sec.p50} s`];
}

function actionText(action: Readonly<Record<string, string | number>>): string {
  return Object.entries(action)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}

function renderDetail(tactic: Tactic): string {
  return document([
    `## ${localize(tactic.name)} (${tactic.id})${tactic.draft === true ? ' (draft)' : ''}`,
    `### 前提 (when)\n\n${codeBlock('json', JSON.stringify(tactic.when, null, 2))}`,
    `### 手順 (do)\n\n${tactic.do.map((action, step) => `${step + 1}. ${actionText(action)}`).join('\n')}`,
    `### 期待結果 (expect)\n\n${codeBlock('json', JSON.stringify(tactic.expect, null, 2))}`,
    `### 根拠 (because)\n\n${tactic.because.map((reason) => `- ${reason}`).join('\n')}`,
  ]).trimEnd();
}

export function renderTactics(bundle: Bundle): string {
  const tactics = bundle.tactics.map(({ doc }) => doc);
  if (tactics.length === 0) return document(['# 定石', '定石はありません。']);
  const summary = table(
    ['ID', '名前', '確信度', 'knowledge', '試行', '成功率', '時間 p50', '置き換え先'],
    tactics.map((tactic) => [tactic.id, localize(tactic.name), tactic.confidence, tactic.knowledge, ...metricsCells(tactic), tactic.superseded_by ?? '-']),
  );
  return document(['# 定石', summary, ...tactics.map(renderDetail)]);
}
