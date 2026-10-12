// C-1 runValidation(load): the fixed V01-V26 list, status consistent with findings.

import type { ValidationReport } from '../validate/run-validation.ts';

const EXPECTED_IDS = Array.from({ length: 26 }, (_, i) => `V${String(i + 1).padStart(2, '0')}`);

export default {
  post: (report: ValidationReport) => {
    const ids = report.checks.map((check) => check.id);
    if (ids.join(',') !== EXPECTED_IDS.join(',')) return 'check list is not V01-V26 in order';
    for (const check of report.checks) {
      const hasError = check.findings.some((finding) => finding.severity === 'error');
      const expected = hasError ? 'error' : check.findings.length > 0 ? 'warning' : 'ok';
      if (check.status !== expected) return `${check.id} status does not match its findings`;
    }
    const ok = report.checks.every((check) => check.status !== 'error');
    return report.ok === ok || 'ok does not match the error checks';
  },
};
