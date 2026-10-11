// ルールブックの過程 (毎ティックの連続変化).

import type { ProcessDefinition } from '@ludiars/commentarii-sdk/types';
import { localize } from '@ludiars/commentarii-sdk/types';
import { document, table } from '../../markdown/markdown.ts';

export function renderProcesses(processes: readonly ProcessDefinition[]): string {
  if (processes.length === 0) return document(['## 過程', '過程はありません。']).trimEnd();
  const rows = processes.map((process) => [
    process.id,
    localize(process.name) || '-',
    process.of,
    process.when,
    process.rate.map((rate) => `${rate.var} := ${rate.expr}`).join('; '),
    process.knowledge,
  ]);
  return document(['## 過程', table(['過程', '名前', '対象', '条件 (when)', '1 副ステップの変化', 'knowledge'], rows)]).trimEnd();
}
