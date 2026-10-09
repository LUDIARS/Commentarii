// Markdown of the mask audit. The first section is short enough to paste into a Revisor
// finding (counts and the top 10); the full tables follow.

import { document, table } from '../markdown/markdown.ts';
import type { AllowedFinding, AuditReport, Finding } from './audit-report.ts';

const TOP_COUNT = 10;

function location(finding: Finding): string {
  return `${finding.file}:${finding.line}:${finding.column}`;
}

function findingTable(findings: readonly Finding[]): string {
  if (findings.length === 0) return '該当なし。';
  return table(['位置', '種別', '参照', '根拠'], findings.map((finding) => [location(finding), finding.kind, finding.ref, finding.reason]));
}

function allowedTable(findings: readonly AllowedFinding[]): string {
  if (findings.length === 0) return '該当なし。';
  return table(
    ['位置', '種別', '参照', 'allow パターン', '除外の根拠', '決めた人'],
    findings.map((finding) => [location(finding), finding.kind, finding.ref, finding.allow.pattern, finding.allow.rationale, finding.allow.decided_by]),
  );
}

function verdict(report: AuditReport): string {
  if (report.hits.length > 0) return `結果: **NG** — masked 値または露出禁止キーの露出 ${report.hits.length} 件`;
  if (report.warnings.length > 0) return `結果: OK (警告 ${report.warnings.length} 件: 境界が未定義の露出候補)`;
  return '結果: OK';
}

export function formatAuditMarkdown(report: AuditReport): string {
  const { summary } = report;
  const top = [...report.hits, ...report.warnings].slice(0, TOP_COUNT);
  const counts = [
    `ゲーム: ${summary.game_id ?? '(manifest なし)'} / 走査ファイル: ${summary.scanned_files}`,
    `hits ${summary.hits} (value-hit ${summary.by_kind['value-hit']} / key-hit ${summary.by_kind['key-hit']}) / warnings ${summary.warnings} (undefined-exposure) / allowed ${summary.allowed}`,
  ].join('\n');
  return document([
    '# マスク監査レポート',
    '## 要約',
    verdict(report),
    counts,
    `上位 ${TOP_COUNT} 件:`,
    top.length === 0 ? '該当なし。' : top.map((finding) => `- \`${location(finding)}\` ${finding.kind} ${finding.ref} — ${finding.reason}`).join('\n'),
    '## hits (value-hit / key-hit)',
    findingTable(report.hits),
    '## warnings (undefined-exposure)',
    findingTable(report.warnings),
    '## allowed (audit.allow で除外)',
    allowedTable(report.allowed),
  ]);
}
