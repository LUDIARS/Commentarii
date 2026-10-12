// V26: a method report adds up: the rows' episodes sum to the report's episodes, the proposers'
// shares of one budget row sum to 1, and so do the overall proposer and selector-rule shares
// (each share is rounded to 1e-4, so the tolerance grows with the number of terms). A report that
// does not add up cannot be the evidence of a budget table proposal.

import type { MethodReport } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';
import { validOutputs } from './engine-outputs.ts';

function sumsToOne(shares: readonly number[]): boolean {
  const sum = shares.reduce((total, share) => total + share, 0);
  return Math.abs(sum - 1) <= 1e-4 * shares.length + 1e-9;
}

function reportFindings(path: string, report: MethodReport): Finding[] {
  const findings: Finding[] = [];
  const episodes = report.rows.reduce((sum, row) => sum + row.episodes, 0);
  if (episodes !== report.episodes) findings.push(error(path, '/episodes', `${report.episodes} episode(s), the rows hold ${episodes}`));
  if (report.rows.length === 0) return findings;
  const byRow = new Map<string, number[]>();
  for (const row of report.rows) byRow.set(row.row, [...(byRow.get(row.row) ?? []), row.share]);
  for (const [row, shares] of byRow) if (!sumsToOne(shares)) findings.push(error(path, '/rows', `the proposer shares of ${row} do not sum to 1`));
  if (!sumsToOne(Object.values(report.proposer_share))) findings.push(error(path, '/proposer_share', 'does not sum to 1'));
  if (!sumsToOne(Object.values(report.rule_share))) findings.push(error(path, '/rule_share', 'does not sum to 1'));
  return findings;
}

export const v26MethodReportShares: Check = {
  id: 'V26',
  title: '方式レポートの回数と割合が整合する',
  run: ({ load }) => validOutputs<MethodReport>(load, 'method-report').flatMap(({ path, doc }) => reportFindings(path, doc)),
};
