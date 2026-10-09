// Runs `guide audit mask`: load the guide, refuse an unsafe configuration, read the scan
// targets, audit and print. Returns the process exit code.

import type { LoadResult } from '../bundle/bundle.ts';
import { isMaskedFilePath } from '../bundle/bundle.ts';
import { auditExitCode } from './audit-exit-code.ts';
import { allowRuleErrors, resolveAuditConfig } from './audit-config.ts';
import { auditMask } from './audit-mask.ts';
import { formatAuditMarkdown } from './format-audit-markdown.ts';
import type { AuditMaskCommand } from './parse-audit-mask-args.ts';
import { looksBinary, selectScanTargets } from './scan-targets.ts';
import type { ScanSource, ScanText } from './scan-source.ts';

export interface AuditIo {
  stdout(text: string): void;
  stderr(text: string): void;
  openBundle(directory: string): Promise<LoadResult>;
  readonly scanSource: ScanSource;
}

/** The guide is unusable for an audit (broken manifest, masked companion or allow list). */
export const EXIT_AUDIT_CONFIG = 1;

/**
 * A broken manifest drops the audit section and a broken `.masked.json` drops its values, so
 * the audit would silently check less than the guide says. Both stop the audit (safe side).
 */
function configErrors(load: LoadResult): string[] {
  const errors = load.issues
    .filter((issue) => issue.path === 'manifest.json' || isMaskedFilePath(issue.path))
    .map((issue) => `${issue.path}${issue.pointer === '' ? '' : ` ${issue.pointer}`}: ${issue.message}`);
  return [...errors, ...allowRuleErrors(resolveAuditConfig(load.bundle.manifest?.doc).allow)];
}

async function readTargets(source: ScanSource, paths: readonly string[]): Promise<ScanText[]> {
  const files: ScanText[] = [];
  for (const path of paths) {
    const text = await source.readText(path);
    if (!looksBinary(text)) files.push({ path, text });
  }
  return files;
}

export async function runAuditMask(command: AuditMaskCommand, io: AuditIo): Promise<number> {
  const load = await io.openBundle(command.bundleDir);
  const errors = configErrors(load);
  if (errors.length > 0) {
    io.stderr(`guide audit mask: the guide cannot be used for the audit:\n${errors.map((error) => `  ${error}\n`).join('')}`);
    return EXIT_AUDIT_CONFIG;
  }
  const config = resolveAuditConfig(load.bundle.manifest?.doc);
  const targets = selectScanTargets(await io.scanSource.listFiles(command.scanPaths), config.extensions);
  const report = auditMask({ load, config, files: await readTargets(io.scanSource, targets) });
  io.stdout(command.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : formatAuditMarkdown(report));
  return auditExitCode(report, command.failOn);
}
