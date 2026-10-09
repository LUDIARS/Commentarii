// Exit code of `guide audit mask`: only hits can fail the gate, and only with --fail-on hit.

import type { AuditReport } from './audit-report.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:2a5f9c0a */
import augurContract_87fdbee6 from '../contracts/audit-exit-code.contract.ts'; /* augur-inject:contract-predicate:818d40c5 */

export type FailOn = 'hit' | 'none';

/** Hits were found and --fail-on hit asked to fail on them. */
export const EXIT_AUDIT_HIT = 1;

export function auditExitCode(report: AuditReport, failOn: FailOn): number {
  return failOn === 'hit' && report.hits.length > 0 ? EXIT_AUDIT_HIT : 0;
}
// @ts-expect-error augur-inject
auditExitCode = contract(auditExitCode, { ...augurContract_87fdbee6, contractId: 'C-16', mode: 'observe', sample: 1, where: 'src/audit/audit-exit-code.ts:10', rule: 'contract-wrap', id: '87fdbee6' }); /* augur-inject:contract-wrap:87fdbee6 */
