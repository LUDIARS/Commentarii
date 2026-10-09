// C-16 auditExitCode(report, failOn): only hits under --fail-on hit fail the gate.

import type { FailOn } from '../audit/audit-exit-code.ts';
import type { AuditReport } from '../audit/audit-report.ts';

export default {
  post: (code: number, report: AuditReport, failOn: FailOn) => {
    const shouldFail = failOn === 'hit' && report.hits.length > 0;
    if (shouldFail) return code !== 0 || 'hits under --fail-on hit exited 0';
    return code === 0 || `exit ${code} without failing hits (fail-on ${failOn})`;
  },
};
