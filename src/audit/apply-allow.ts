// Moves findings declared harmless in `audit.allow[]` out of the report's hits and warnings.
// The first matching rule wins; its rationale and decider travel with the finding.

import type { AllowRule } from './audit-config.ts';
import type { AllowedFinding, Finding } from './audit-report.ts';
import { globToRegExp } from './path-glob.ts';

export interface AllowResult {
  readonly kept: readonly Finding[];
  readonly allowed: readonly AllowedFinding[];
}

export function applyAllow(findings: readonly Finding[], rules: readonly AllowRule[]): AllowResult {
  const compiled = rules.map((rule) => ({ rule, path: globToRegExp(rule.pattern) }));
  const kept: Finding[] = [];
  const allowed: AllowedFinding[] = [];
  for (const finding of findings) {
    const match = compiled.find(
      ({ rule, path }) => path.test(finding.file) && (rule.kind === undefined || rule.kind === finding.kind) && (rule.ref === undefined || rule.ref === finding.ref),
    );
    if (match === undefined) kept.push(finding);
    else allowed.push({ ...finding, allow: { pattern: match.rule.pattern, rationale: match.rule.rationale, decided_by: match.rule.decided_by } });
  }
  return { kept, allowed };
}
