// Gate verdicts and decision regressions -> the Markdown pasted into a Revisor review: summary
// first, then the experience-block candidates, the metric table, what changed and the limits.
// Wording states facts and never calls the experience verified.

import type { DecisionRegression } from './decision-regression.ts';
import type { GateVerdict } from './gate-balance.ts';

const STATUS_TEXT = {
  pass: '閾値を超えた指標なし (sim 上)',
  candidates: '体験ブロック候補あり (sim 上の実測変化)',
  incomparable: '比較不能 (条件が違う結果は比べない)',
} as const;

function value(number: number | null): string {
  return number === null ? '-' : String(number);
}

export function formatGateMarkdown(verdict: GateVerdict): string {
  const { comparison } = verdict;
  const lines = ['# バランス回帰ゲート (live balance, evidence: sim)', '', `- 判定: ${STATUS_TEXT[verdict.status]}${verdict.fail ? ' → ゲート失敗' : ''}`];
  if (!comparison.comparable) {
    lines.push('', '## 比較できない理由', '', ...comparison.incompatibilities.map((reason) => `- ${reason}`));
  } else {
    lines.push('', '## 体験ブロック候補', '', ...(comparison.candidates.length === 0 ? ['なし'] : comparison.candidates.map((candidate) => `- ${candidate}`)));
    lines.push('', '## 指標', '', '| 指標 | base | head | 変化 | 閾値 | 超過 |', '|---|---|---|---|---|---|');
    for (const metric of comparison.metrics) lines.push(`| ${metric.metric} | ${value(metric.base)} | ${value(metric.head)} | ${value(metric.change)} | ${metric.threshold} | ${metric.exceeded ? 'はい' : 'いいえ'} |`);
  }
  lines.push('', `- 測った変更 (base と head で違うもの): ${comparison.changed.join(', ') || 'なし'}`);
  lines.push('', '## この判定が示さないこと', '', ...verdict.limits.map((limit) => `- ${limit}`));
  return `${lines.join('\n')}\n`;
}

export function formatRegressionMarkdown(regression: DecisionRegression): string {
  const lines = [
    '# 判断回帰 (decision regression, evidence: replay)',
    '',
    `- ${regression.note}`,
    `- run: ${regression.matched_runs} / ${regression.runs} が全ティック一致 (一致率 ${value(regression.run_match_rate)})、ティック一致率 ${value(regression.tick_match_rate)}`,
    '',
    '## 分岐した run',
    '',
    ...(regression.divergent.length === 0 ? ['なし'] : regression.divergent.map((run) => `- ${run.run_id}: tick ${run.tick} で最初に分岐`)),
  ];
  return `${lines.join('\n')}\n`;
}
