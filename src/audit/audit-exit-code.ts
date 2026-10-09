// Exit code of `guide audit mask`: only hits can fail the gate, and only with --fail-on hit.

import type { AuditReport } from './audit-report.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:2a5f9c0a */
import augurContract_affc6314 from '../contracts/audit-exit-code.contract.ts'; /* augur-inject:contract-predicate:8939d38c */

export type FailOn = 'hit' | 'none';

/** Hits were found and --fail-on hit asked to fail on them. */
export const EXIT_AUDIT_HIT = 1;

export function auditExitCode(report: AuditReport, failOn: FailOn): number {
  return failOn === 'hit' && report.hits.length > 0 ? EXIT_AUDIT_HIT : 0;
}
// @ts-expect-error augur-inject
auditExitCode = contract(auditExitCode, { ...augurContract_affc6314, contractId: 'C-16', mode: 'observe', sample: 1, where: 'src/audit/audit-exit-code.ts:10', rule: 'contract-wrap', id: 'affc6314' }); /* augur-inject:contract-wrap:affc6314 */
