// Runs every check of the fixed list and summarizes the result per check ID.

import { buildBundleIndex } from '../bundle/bundle-index.ts';
import type { LoadResult } from '../bundle/bundle.ts';
import type { CheckId, Finding } from './check.ts';
import { CHECKS } from './checks/index.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:1d471e62 */
import augurContract_fbfc1d23 from '../contracts/run-validation.contract.ts'; /* augur-inject:contract-predicate:01e465af */

export type CheckStatus = 'ok' | 'warning' | 'error';

export interface CheckResult {
  readonly id: CheckId;
  readonly title: string;
  readonly status: CheckStatus;
  readonly findings: readonly Finding[];
}

export interface ValidationReport {
  /** True when no check reported an error. Warnings do not fail validation. */
  readonly ok: boolean;
  readonly checks: readonly CheckResult[];
}

function statusOf(findings: readonly Finding[]): CheckStatus {
  if (findings.some((finding) => finding.severity === 'error')) return 'error';
  return findings.length > 0 ? 'warning' : 'ok';
}

function byLocation(a: Finding, b: Finding): number {
  return a.path.localeCompare(b.path) || a.pointer.localeCompare(b.pointer) || a.message.localeCompare(b.message);
}

export function runValidation(load: LoadResult): ValidationReport {
  const context = { load, index: buildBundleIndex(load.bundle) };
  const checks = CHECKS.map((check): CheckResult => {
    const findings = [...check.run(context)].sort(byLocation);
    return { id: check.id, title: check.title, status: statusOf(findings), findings };
  });
  return { ok: checks.every((check) => check.status !== 'error'), checks };
}
// @ts-expect-error augur-inject
runValidation = contract(runValidation, { ...augurContract_fbfc1d23, contractId: 'C-1', mode: 'observe', sample: 1, where: 'src/validate/run-validation.ts:32', rule: 'contract-wrap', id: 'fbfc1d23' }); /* augur-inject:contract-wrap:fbfc1d23 */
