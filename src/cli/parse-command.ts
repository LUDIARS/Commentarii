// Command line -> command. Unknown commands and options are usage errors.

import { parseArgs } from 'node:util';
import { AUDIT_USAGE, parseAuditArgs, type AuditMaskCommand } from '../audit/parse-audit-mask-args.ts';
import { AUTOPLAY_USAGE, parseBenchCommand, parseRunCommand, type AutoplayCommand } from '../autoplay/autoplay-command.ts';
import { EXPORT_USAGE, parseExportCommand, type ExportCommand } from '../export/export-command.ts';
import { parseImportPlaysCommand, parseReportPlaysCommand, PLAYS_USAGE, type PlaysCommand } from '../import/plays/plays-command.ts';
import type { RenderKnowledge } from '../render/render-bundle.ts';
import { parseReplayCommand, REPLAY_USAGE, type ReplayCommand } from '../replay/replay-command.ts';
import { IMPORT_USAGE, parseImportCommand, type ImportCommand } from './parse-import-command.ts';
import { LEARN_USAGE, parseLearnCommand, type LearnCommand } from '../learn/cli/learn-command.ts';
import { GATE_USAGE, parseBenchCompare, parseBenchReplay, parseGateCommand, type GateCommand } from '../gate/cli/gate-command.ts';
import { parseReportFeasibilityCommand, parseVerifyCommand, VERIFY_USAGE, type VerifyCommand } from '../verify/cli/verify-command.ts';
import { UsageError } from './usage-error.ts';

export { UsageError };

export type Command =
  | { readonly name: 'validate'; readonly bundleDir: string; readonly json: boolean }
  | { readonly name: 'render'; readonly bundleDir: string; readonly outDir: string; readonly knowledge: RenderKnowledge }
  | { readonly name: 'report-knowledge'; readonly bundleDir: string; readonly json: boolean }
  | ReplayCommand
  | ImportCommand
  | AuditMaskCommand
  | ExportCommand
  | AutoplayCommand
  | LearnCommand
  | GateCommand
  | PlaysCommand
  | VerifyCommand
  | { readonly name: 'help' };

export const USAGE = `usage:
  guide validate <bundle-dir> [--json]
  guide render <bundle-dir> --out <dir> [--knowledge player|full]
  guide report knowledge <bundle-dir> [--json]
${EXPORT_USAGE}${AUTOPLAY_USAGE}${REPLAY_USAGE}${IMPORT_USAGE}${PLAYS_USAGE}${AUDIT_USAGE}${LEARN_USAGE}${VERIFY_USAGE}${GATE_USAGE}`;

function single(positionals: readonly string[], what: string): string {
  if (positionals.length !== 1 || positionals[0] === undefined) throw new UsageError(`${what} needs exactly one <bundle-dir>`);
  return positionals[0];
}

export function parseCommand(argv: readonly string[]): Command {
  const [name, ...rest] = argv;
  if (name === undefined || name === 'help' || name === '--help' || name === '-h') return { name: 'help' };
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
      if (topic !== 'knowledge') throw new UsageError('report supports: report knowledge | report plays | report feasibility');
      const { values, positionals } = parseArgs({ args: options, allowPositionals: true, options: { json: { type: 'boolean' } } });
      return { name: 'report-knowledge', bundleDir: single(positionals, 'report knowledge'), json: values.json === true };
    }
    if (name === 'replay') return parseReplayCommand(rest);
    if (name === 'import' || name === 'intent') return parseImportCommand(name, rest);
    if (name === 'audit') return parseAuditArgs(rest);
    if (name === 'export') return parseExportCommand(rest);
    if (name === 'run') return parseRunCommand(rest);
    if (name === 'bench' && rest[0] === 'compare') return parseBenchCompare(rest.slice(1));
    if (name === 'bench' && rest[0] === 'replay') return parseBenchReplay(rest.slice(1));
    if (name === 'bench') return parseBenchCommand(rest);
    if (name === 'gate') return parseGateCommand(rest);
    if (name === 'learn') return parseLearnCommand(rest);
    if (name === 'verify') return parseVerifyCommand(rest);
  } catch (cause) {
    if (cause instanceof UsageError) throw cause;
    throw new UsageError((cause as Error).message);
  }
  throw new UsageError(`unknown command '${name}'`);
}
