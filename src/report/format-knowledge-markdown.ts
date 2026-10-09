// Markdown of the knowledge boundary report: the designer's checklist of what is shown and
// what is hidden.

import { document, percent, table } from '../markdown/markdown.ts';
import type { KnowledgeReport } from './knowledge-report.ts';

const REASON_LABEL = { 'missing-source': 'source なし', 'llm-draft-source': 'LLM 下書きのみ' } as const;

export function formatKnowledgeMarkdown(report: KnowledgeReport): string {
  const { totals } = report;
  const entityTable = table(
    ['エンティティ', 'shown', 'discoverable', 'masked', '計', 'shown 率', 'discoverable 率', 'masked 率'],
    report.entities.map((row) => [
      row.id,
      row.shown,
      row.discoverable,
      row.masked,
      row.total,
      percent(row.ratio.shown),
      percent(row.ratio.discoverable),
      percent(row.ratio.masked),
    ]),
  );
  const totalsLine = `全体: shown ${totals.shown} (${percent(totals.ratio.shown)}) / discoverable ${totals.discoverable} (${percent(totals.ratio.discoverable)}) / masked ${totals.masked} (${percent(totals.ratio.masked)}) / 計 ${totals.total}`;
  const ungrounded =
    report.ungrounded.length === 0
      ? '該当なし。'
      : table(['ファイル', '位置', 'knowledge', '理由'], report.ungrounded.map((value) => [value.path, value.pointer, value.knowledge, REASON_LABEL[value.reason]]));
  const tactics =
    report.tactics_referencing_masked.length === 0
      ? '該当なし。'
      : table(['定石', 'masked 参照数'], report.tactics_referencing_masked.map((entry) => [entry.tactic, entry.masked_refs]));
  return document([
    '# 知識境界レポート',
    `ゲーム: ${report.game_id ?? '(manifest なし)'}`,
    '## エンティティ別の境界',
    entityTable,
    totalsLine,
    '## 根拠の無い shown / discoverable',
    ungrounded,
    '## masked を参照する定石',
    tactics,
  ]);
}
