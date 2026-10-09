// `guide export <bundle-dir> --out <dir> [--knowledge player|full] [--target runtime]` arguments.
// Errors are thrown as plain Errors; parse-command.ts turns them into usage errors.

import { parseArgs } from 'node:util';
import { EXPORT_TARGETS, type ExportKnowledge, type ExportTarget } from './exported-bundle.ts';

export interface ExportCommand {
  readonly name: 'export';
  readonly bundleDir: string;
  readonly outDir: string;
  readonly knowledge: ExportKnowledge;
  readonly target: ExportTarget;
}

export const EXPORT_USAGE = `  guide export <bundle-dir> --out <dir> [--knowledge player|full] [--target ${EXPORT_TARGETS.join('|')}]
`;

function isTarget(value: string): value is ExportTarget {
  return (EXPORT_TARGETS as readonly string[]).includes(value);
}

export function parseExportCommand(args: readonly string[]): ExportCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { out: { type: 'string' }, knowledge: { type: 'string', default: 'player' }, target: { type: 'string', default: 'runtime' } },
  });
  const [bundleDir, ...extra] = positionals;
  if (bundleDir === undefined || extra.length > 0) throw new Error('export needs exactly one <bundle-dir>');
  if (values.out === undefined || values.out === '') throw new Error('export needs --out <dir>');
  if (values.knowledge !== 'player' && values.knowledge !== 'full') throw new Error('--knowledge must be player or full');
  if (!isTarget(values.target)) throw new Error(`--target must be one of: ${EXPORT_TARGETS.join(', ')}`);
  return { name: 'export', bundleDir, outDir: values.out, knowledge: values.knowledge, target: values.target };
}
