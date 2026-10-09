// 意図一覧: what the designer expects per stage, and the divergences already accepted.

import type { Bundle } from '../bundle/bundle.ts';
import type { IntendedItem, Intent } from '../domain/documents.ts';
import { document, table } from '../markdown/markdown.ts';

function intendedText(item: IntendedItem): string {
  switch (item.kind) {
    case 'route':
      return item.path.join(' → ');
    case 'teach':
      return item.tactic;
    case 'time':
      return `${item.range_sec[0]} 〜 ${item.range_sec[1]} 秒`;
    case 'forbid':
      return item.area;
  }
}

function renderIntent(intent: Intent): string {
  const intended = table(
    ['ID', '種別', '内容', '注記'],
    intent.intended.map((item) => [item.id, item.kind, intendedText(item), item.note ?? '-']),
  );
  const divergences =
    intent.allowed_divergences.length === 0
      ? '許容済みのズレはありません。'
      : table(
          ['run', '概要', '判定者', '定石'],
          intent.allowed_divergences.map((divergence) => [divergence.run, divergence.summary, divergence.decided_by, divergence.tactic ?? '-']),
        );
  return document([`## ${intent.stage}`, intended, '### 許容したズレ', divergences]).trimEnd();
}

export function renderIntents(bundle: Bundle): string {
  return document(['# 意図', ...(bundle.intents.length === 0 ? ['意図はありません。'] : bundle.intents.map(({ doc }) => renderIntent(doc)))]);
}
