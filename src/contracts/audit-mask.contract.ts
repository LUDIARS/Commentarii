// C-15 auditMask(input): findings land in the right bucket, allowed ones carry their rationale,
// the summary matches the arrays, and no masked string value is echoed by the report.

import type { AuditInput } from '../audit/audit-mask.ts';
import type { AuditReport } from '../audit/audit-report.ts';
import { collectMaskedNeedles } from '../audit/masked-needles.ts';

/** The report minus scanned file paths (a game file may legitimately be named like a value). */
function reportText(report: AuditReport): string {
  return JSON.stringify(report, (key, value: unknown) => (key === 'file' ? '' : value));
}

export default {
  post: (report: AuditReport, input: AuditInput) => {
    if (report.hits.some((finding) => finding.kind === 'undefined-exposure')) return 'undefined-exposure in hits';
    if (report.warnings.some((finding) => finding.kind !== 'undefined-exposure')) return 'hit in warnings';
    for (const finding of report.allowed) {
      if (finding.allow.rationale.trim() === '' || finding.allow.decided_by.trim() === '') return `allowed ${finding.file}:${finding.line} has no rationale or decider`;
    }
    const allowedKeys = new Set(report.allowed.map((finding) => `${finding.file}:${finding.line}:${finding.column}:${finding.kind}:${finding.ref}`));
    for (const finding of [...report.hits, ...report.warnings]) {
      if (allowedKeys.has(`${finding.file}:${finding.line}:${finding.column}:${finding.kind}:${finding.ref}`)) return 'finding both kept and allowed';
    }
    const { summary } = report;
    if (summary.hits !== report.hits.length || summary.warnings !== report.warnings.length || summary.allowed !== report.allowed.length) return 'summary counts differ';
    if (summary.scanned_files !== input.files.length) return 'scanned_files differs from the input';
    const kinds = summary.by_kind;
    if (kinds['value-hit'] + kinds['key-hit'] !== summary.hits || kinds['undefined-exposure'] !== summary.warnings) return 'by_kind differs from hits / warnings';
    const text = reportText(report);
    for (const needle of collectMaskedNeedles(input.load.bundle)) {
      if (needle.kind !== 'number' && text.includes(needle.text)) return `report echoes the masked value of ${needle.ref}`;
    }
    return true;
  },
};
