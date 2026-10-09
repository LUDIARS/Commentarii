// `guide audit mask` core: compare the scanned game files against the guide's masked values,
// forbidden keys and known numbers, then apply the allow list. Pure: files are already read.

import type { LoadResult } from '../bundle/bundle.ts';
import { applyAllow } from './apply-allow.ts';
import type { AuditConfig } from './audit-config.ts';
import type { AuditReport, Finding, FindingKind } from './audit-report.ts';
import { detectKeyHits } from './detect-key-hits.ts';
import { detectUndefinedExposure } from './detect-undefined-exposure.ts';
import { detectValueHits } from './detect-value-hits.ts';
import { collectGuideNumbers } from './guide-numbers.ts';
import { collectMaskedNeedles } from './masked-needles.ts';
import type { ScanText } from './scan-source.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:2f3bbf2d */
import augurContract_552b5a0c from '../contracts/audit-mask.contract.ts'; /* augur-inject:contract-predicate:5e1421ac */

export interface AuditInput {
  readonly load: LoadResult;
  readonly config: AuditConfig;
  /** Scan targets, already selected and read (binary files left out). */
  readonly files: readonly ScanText[];
}

function byPosition(a: Finding, b: Finding): number {
  return a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.kind.localeCompare(b.kind) || a.ref.localeCompare(b.ref);
}

function countByKind(findings: readonly Finding[]): Record<FindingKind, number> {
  const counts: Record<FindingKind, number> = { 'value-hit': 0, 'key-hit': 0, 'undefined-exposure': 0 };
  for (const finding of findings) counts[finding.kind] += 1;
  return counts;
}

export function auditMask(input: AuditInput): AuditReport {
  const { load, config, files } = input;
  const needles = collectMaskedNeedles(load.bundle);
  const guideNumbers = collectGuideNumbers(load.files);
  const findings: Finding[] = [];
  for (const file of files) {
    findings.push(
      ...detectValueHits(file, needles, config.minNumericLength),
      ...detectKeyHits(file, config.forbiddenKeys),
      ...detectUndefinedExposure(file, guideNumbers, config.minNumericLength),
    );
  }
  findings.sort(byPosition);
  const { kept, allowed } = applyAllow(findings, config.allow);
  const hits = kept.filter((finding) => finding.kind !== 'undefined-exposure');
  const warnings = kept.filter((finding) => finding.kind === 'undefined-exposure');
  return {
    summary: {
      game_id: load.bundle.manifest?.doc.game_id,
      scanned_files: files.length,
      hits: hits.length,
      warnings: warnings.length,
      allowed: allowed.length,
      by_kind: countByKind(kept),
    },
    hits,
    warnings,
    allowed,
  };
}
// @ts-expect-error augur-inject
auditMask = contract(auditMask, { ...augurContract_552b5a0c, contractId: 'C-15', mode: 'observe', sample: 1, where: 'src/audit/audit-mask.ts:32', rule: 'contract-wrap', id: '552b5a0c' }); /* augur-inject:contract-wrap:552b5a0c */
