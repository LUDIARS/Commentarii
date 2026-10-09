// Markdown for `guide replay diff`: the first branch with per-candidate utilities, then the
// action differences from that tick on.

import { document, table } from '../markdown/markdown.ts';
import type { DivergenceReason, ReplayDiff } from './diff-replays.ts';
import { formatAction } from './format-action.ts';

const REASON_LABEL: Readonly<Record<DivergenceReason, string>> = {
  action: '行動が異なる',
  decision: '選ばれた候補が異なる',
  'missing-tick': '片方の run にしか無いティック',
};

function number(value: number | null): string {
  return value === null ? '-' : String(Number(value.toFixed(6)));
}

function mark(chosen: boolean): string {
  return chosen ? '✓' : '';
}

export function formatReplayDiffMarkdown(diff: ReplayDiff): string {
  const sections = [
    '# リプレイ差分',
    [`- A: \`${diff.a.run_id}\` (${diff.a.ticks} ティック)`, `- B: \`${diff.b.run_id}\` (${diff.b.ticks} ティック)`].join('\n'),
  ];
  const divergence = diff.first_divergence;
  if (divergence === null) {
    sections.push('判断の分岐はありません (全ティックで行動と選ばれた候補が一致)。');
    return document(sections);
  }
  sections.push(
    '## 最初の分岐',
    [
      `- ティック: ${divergence.tick}`,
      `- 理由: ${divergence.reasons.map((reason) => REASON_LABEL[reason]).join(' / ')}`,
      `- A の行動: \`${formatAction(divergence.a_action)}\` (候補: ${divergence.a_chosen ?? '-'})`,
      `- B の行動: \`${formatAction(divergence.b_action)}\` (候補: ${divergence.b_chosen ?? '-'})`,
    ].join('\n'),
  );
  if (divergence.utilities.length > 0) {
    sections.push(
      table(
        ['候補', 'A 効用', 'B 効用', '差 (B − A)', 'A 選択', 'B 選択'],
        divergence.utilities.map((row) => [row.candidate, number(row.a), number(row.b), number(row.delta), mark(row.chosen_a), mark(row.chosen_b)]),
      ),
    );
  } else {
    sections.push('この時点の判断ログ (候補と効用値) はどちらの run にもありません。');
  }
  const { count, shown } = diff.action_diff;
  sections.push('## 以後の行動差分', `件数: ${count} (先頭 ${shown.length} 件を表示)`);
  if (shown.length > 0) {
    sections.push(table(['ティック', 'A', 'B'], shown.map((row) => [row.tick, formatAction(row.a), formatAction(row.b)])));
  }
  return document(sections);
}
