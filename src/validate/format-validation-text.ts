// Human-readable text of a validation report: one line per check, findings indented below it.

import type { ValidationReport } from './run-validation.ts';

const STATUS_LABEL = { ok: 'OK  ', warning: 'WARN', error: 'NG  ' } as const;

export function formatValidationText(report: ValidationReport): string {
  const lines: string[] = [];
  for (const check of report.checks) {
    lines.push(`${STATUS_LABEL[check.status]} ${check.id} ${check.title}`);
    for (const finding of check.findings) {
      const location = finding.pointer === '' ? finding.path : `${finding.path}#${finding.pointer}`;
      lines.push(`       [${finding.severity}] ${location}: ${finding.message}`);
    }
  }
  const errors = report.checks.filter((check) => check.status === 'error').length;
  const warnings = report.checks.filter((check) => check.status === 'warning').length;
  lines.push(report.ok ? `result: OK (${warnings} warning check(s))` : `result: NG (${errors} failing check(s), ${warnings} warning check(s))`);
  return `${lines.join('\n')}\n`;
}
