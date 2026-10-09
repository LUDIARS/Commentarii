// Consolidation -> the Markdown a person reviews (design 8.2: "旧 → 新、実測比較、根拠 run"):
// what was applied, what waits and why, and per proposal the change and its evidence. The JSON
// Patch of every file is shown as is (RFC 6902), so the review sees exactly what would be written.

import type { TacticMetrics } from '../../domain/documents.ts';
import type { Consolidation } from './plan-consolidation.ts';
import type { Proposal } from './proposal.ts';

function json(value: unknown): string {
  return `\`${JSON.stringify(value)}\``;
}

function metricsLine(metrics: TacticMetrics | undefined): string {
  if (metrics === undefined) return '-';
  const time = metrics.time_sec?.p50 === undefined ? '-' : `${metrics.time_sec.p50} s`;
  const damage = metrics.risk?.damage_taken_p50 ?? '-';
  return `試行 ${metrics.runs} / 成功率 ${metrics.success} / 時間 p50 ${time} / 被ダメ p50 ${damage} / 資源 ${json(metrics.resource ?? {})}`;
}

function detail(proposal: Proposal): string[] {
  const lines: string[] = [];
  const { rewrite, promotion } = proposal;
  if (rewrite !== undefined) {
    lines.push(`- 元の定石: ${rewrite.of} (変異 ${rewrite.mutation})`);
    lines.push(`- 旧 when: ${json(rewrite.before.when)}`, `- 新 when: ${json(rewrite.after.when)}`);
    lines.push(`- 旧 do: ${json(rewrite.before.do)}`, `- 新 do: ${json(rewrite.after.do)}`);
    lines.push(`- 実測 (旧): ${metricsLine(rewrite.origin_metrics)}`, `- 実測 (新): ${metricsLine(rewrite.variant_metrics)}`);
    lines.push(`- 合成ゲイン: ${rewrite.gain}`);
  }
  if (promotion !== undefined) {
    lines.push(`- 値: ${promotion.ref} = ${promotion.value} (masked → discoverable)`);
    lines.push(`- player run ${promotion.player_runs} 本 / 一致率 ${promotion.agreement} (必要: ${promotion.requires.player_runs} 本 / ${promotion.requires.agreement})`);
  }
  lines.push(`- 根拠 run: ${proposal.evidence.join(', ') || '-'}`);
  for (const file of proposal.files) lines.push(`- ${file.create ? '新規' : '変更'} ${file.path}: ${json(file.patch)}`);
  return lines;
}

function section(title: string, proposals: readonly Proposal[], state: (proposal: Proposal) => string): string {
  if (proposals.length === 0) return `## ${title}\n\nなし\n`;
  const blocks = proposals.map((proposal) => [`### ${proposal.id} (${state(proposal)})`, '', `${proposal.reason}`, '', ...detail(proposal)].join('\n'));
  return `## ${title}\n\n${blocks.join('\n\n')}\n`;
}

export function formatConsolidateMarkdown(consolidation: Consolidation): string {
  const applied = new Set(consolidation.applied);
  const state = (proposal: Proposal): string => (applied.has(proposal.id) ? '反映済み' : proposal.status === 'auto' ? '自動反映可 (--apply で反映)' : '承認待ち');
  const of = (kind: Proposal['kind']): Proposal[] => consolidation.proposals.filter((proposal) => proposal.kind === kind);
  return [
    '# learn consolidate\n',
    `- 反映した提案: ${consolidation.applied.length} (${consolidation.applied.join(', ') || '-'})`,
    `- 残した提案: ${consolidation.remaining.length} (${consolidation.remaining.join(', ') || '-'})`,
    `- 書いたファイル: ${consolidation.changes.map((change) => change.path).join(', ') || 'なし'}\n`,
    section('定石の書き換え', of('rewrite'), state),
    section('境界の昇格候補 (人間承認)', of('promotion'), state),
    section('未知 entity の雛形 (人間承認)', of('entity-draft'), state),
  ].join('\n');
}
