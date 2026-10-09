import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuditReport, Finding } from '../../src/audit/audit-report.ts';
import { formatAuditMarkdown } from '../../src/audit/format-audit-markdown.ts';

function finding(line: number): Finding {
  return { kind: 'value-hit', file: 'ui/en.json', line, column: 1, ref: `enemy:g:a.stats.v${line}`, reason: 'r' };
}

function report(hits: readonly Finding[]): AuditReport {
  return {
    summary: { game_id: 'g', scanned_files: 1, hits: hits.length, warnings: 0, allowed: 0, by_kind: { 'value-hit': hits.length, 'key-hit': 0, 'undefined-exposure': 0 } },
    hits,
    warnings: [],
    allowed: [],
  };
}

test('the paste-able summary (counts and top 10) comes first', () => {
  const markdown = formatAuditMarkdown(report(Array.from({ length: 12 }, (_, index) => finding(index + 1))));
  const summary = markdown.slice(0, markdown.indexOf('## hits'));
  assert.match(markdown, /^# マスク監査レポート\n\n## 要約\n\n結果: \*\*NG\*\*/);
  assert.match(summary, /hits 12 \(value-hit 12 \/ key-hit 0\)/);
  assert.equal(summary.match(/^- `ui\/en\.json:/gm)?.length, 10);
  assert.ok(markdown.includes('ui/en.json:12:1'));
});

test('a clean report says OK', () => {
  assert.match(formatAuditMarkdown(report([])), /結果: OK\n/);
});
