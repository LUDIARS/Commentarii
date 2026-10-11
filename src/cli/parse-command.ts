// Command line -> command. Unknown commands and options are usage errors.

import { parseArgs } from 'node:util';
import { AUDIT_USAGE, parseAuditArgs, type AuditMaskCommand } from '../audit/parse-audit-mask-args.ts';
import { COMMENTARY_USAGE, parseCommentaryCommand, type CommentaryCommand } from '../commentary/commentary-command.ts';
import { DIFF_USAGE, parseDiffCommand, type DiffCommand } from '../diff/diff-command.ts';
import { EXPORT_USAGE, parseExportCommand, type ExportCommand } from '../export/export-command.ts';
import { parseImportPlaysCommand, parseReportPlaysCommand, PLAYS_USAGE, type PlaysCommand } from '../import/plays/plays-command.ts';
import type { RenderKnowledge } from '../render/render-bundle.ts';
import { IMPORT_USAGE, parseImportCommand, type ImportCommand } from './parse-import-command.ts';
import { LEARN_USAGE, parseLearnCommand, type LearnCommand } from '../learn/cli/learn-command.ts';
import { parseReportFeasibilityCommand, parseVerifyCommand, VERIFY_USAGE, type VerifyCommand } from '../verify/cli/verify-command.ts';
import { DELEGATED_USAGE, isDelegatedCommand } from '../delegate/delegated-command.ts';
import { UsageError } from './usage-error.ts';

export { UsageError };

export type Command =
  | { readonly name: 'validate'; readonly bundleDir: string; readonly json: boolean }
  | { readonly name: 'render'; readonly bundleDir: string; readonly outDir: string; readonly knowledge: RenderKnowledge }
  | { readonly name: 'report-knowledge'; readonly bundleDir: string; readonly json: boolean }
  | ImportCommand
  | AuditMaskCommand
  | ExportCommand
  | DiffCommand
  | CommentaryCommand
  | LearnCommand
  | PlaysCommand
  | VerifyCommand
  | { readonly name: 'delegated'; readonly argv: readonly string[] }
  | { readonly name: 'help' };

export const USAGE = `usage:
  guide validate <bundle-dir> [--json]
  guide render <bundle-dir> --out <dir> [--knowledge player|full]
  guide report knowledge <bundle-dir> [--json]
${EXPORT_USAGE}${DIFF_USAGE}${COMMENTARY_USAGE}${IMPORT_USAGE}${PLAYS_USAGE}${AUDIT_USAGE}${LEARN_USAGE}${VERIFY_USAGE}${DELEGATED_USAGE}`;

function single(positionals: readonly string[], what: string): string {
  if (positionals.length !== 1 || positionals[0] === undefined) throw new UsageError(`${what} needs exactly one <bundle-dir>`);
  return positionals[0];
}

export function parseCommand(argv: readonly string[]): Command {
  const [name, ...rest] = argv;
  if (name === undefined || name === 'help' || name === '--help' || name === '-h') return { name: 'help' };
  // Moved to Ingenium (R0-B): handed over unparsed, ingenium owns the arguments.
  if (isDelegatedCommand(argv)) return { name: 'delegated', argv: [...argv] };
  try {
    if (name === 'validate') {
      const { values, positionals } = parseArgs({ args: [...rest], allowPositionals: true, options: { json: { type: 'boolean' } } });
      return { name: 'validate', bundleDir: single(positionals, 'validate'), json: values.json === true };
    }
    if (name === 'render') {
      const { values, positionals } = parseArgs({
        args: [...rest],
        allowPositionals: true,
        options: { out: { type: 'string' }, knowledge: { type: 'string', default: 'player' } },
      });
      if (values.out === undefined || values.out === '') throw new UsageError('render needs --out <dir>');
      if (values.knowledge !== 'player' && values.knowledge !== 'full') throw new UsageError('--knowledge must be player or full');
      return { name: 'render', bundleDir: single(positionals, 'render'), outDir: values.out, knowledge: values.knowledge };
    }
    if (name === 'report' && rest[0] === 'plays') return parseReportPlaysCommand(rest.slice(1));
    if (name === 'report' && rest[0] === 'feasibility') return parseReportFeasibilityCommand(rest.slice(1));
    if (name === 'import' && rest[0] === 'plays') return parseImportPlaysCommand(rest.slice(1));
    if (name === 'report') {
      const [topic, ...options] = rest;
      if (topic !== 'knowledge') throw new UsageError('report supports: report knowledge | report plays | report feasibility (report signatures moved to Ingenium)');
      const { values, positionals } = parseArgs({ args: options, allowPositionals: true, options: { json: { type: 'boolean' } } });
      return { name: 'report-knowledge', bundleDir: single(positionals, 'report knowledge'), json: values.json === true };
    }
    if (name === 'import' || name === 'intent') return parseImportCommand(name, rest);
    if (name === 'audit') return parseAuditArgs(rest);
    if (name === 'export') return parseExportCommand(rest);
    if (name === 'diff') return parseDiffCommand(rest);
    if (name === 'commentary') return parseCommentaryCommand(rest);
    if (name === 'learn') return parseLearnCommand(rest);
    if (name === 'verify') return parseVerifyCommand(rest);
  } catch (cause) {
    if (cause instanceof UsageError) throw cause;
    throw new UsageError((cause as Error).message);
  }
  throw new UsageError(`unknown command '${name}'`);
}
