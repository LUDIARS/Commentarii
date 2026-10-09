// The manifest `audit` section with defaults applied (schema/manifest.schema.json $defs.audit).

import type { Manifest } from '../domain/documents.ts';
import type { FindingKind } from './audit-report.ts';

export interface AllowRule {
  readonly pattern: string;
  readonly kind?: FindingKind;
  readonly ref?: string;
  readonly rationale: string;
  readonly decided_by: string;
}

/** The section as written in manifest.json (already schema-valid). */
interface ManifestAudit {
  readonly scan?: { readonly extensions?: readonly string[] };
  readonly min_numeric_length?: number;
  readonly forbidden_keys?: readonly string[];
  readonly allow?: readonly AllowRule[];
}

export interface AuditConfig {
  readonly extensions: readonly string[];
  readonly minNumericLength: number;
  readonly forbiddenKeys: readonly string[];
  readonly allow: readonly AllowRule[];
}

/**
 * UI strings and localization tables, network response schemas, log output and save formats
 * (spec/tasks/2026-10-09-stage-2b-mask-audit.md). `.d.ts` is covered by `.ts`.
 */
export const DEFAULT_EXTENSIONS: readonly string[] = [
  '.json',
  '.csv',
  '.po',
  '.resx',
  '.yaml',
  '.yml',
  '.proto',
  '.ts',
  '.js',
  '.cs',
  '.cpp',
  '.h',
];

export const DEFAULT_MIN_NUMERIC_LENGTH = 3;

/**
 * An allow without a rationale or a decider is an error, not a silent exclusion. The schema
 * already demands both; this guards configs built in code and keeps the rule next to its use.
 */
export function allowRuleErrors(rules: readonly AllowRule[]): string[] {
  const errors: string[] = [];
  rules.forEach((rule, index) => {
    if (typeof rule.rationale !== 'string' || rule.rationale.trim() === '') errors.push(`audit.allow[${index}] (${rule.pattern}) has no rationale`);
    if (typeof rule.decided_by !== 'string' || rule.decided_by.trim() === '') errors.push(`audit.allow[${index}] (${rule.pattern}) has no decided_by`);
  });
  return errors;
}

export function resolveAuditConfig(manifest: Manifest | undefined): AuditConfig {
  const audit = (manifest as { readonly audit?: ManifestAudit } | undefined)?.audit;
  return {
    extensions: audit?.scan?.extensions ?? DEFAULT_EXTENSIONS,
    minNumericLength: audit?.min_numeric_length ?? DEFAULT_MIN_NUMERIC_LENGTH,
    forbiddenKeys: audit?.forbidden_keys ?? [],
    allow: audit?.allow ?? [],
  };
}
