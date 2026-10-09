// Command line -> command. Unknown commands and options are usage errors.

import { parseArgs } from 'node:util';
import type { RenderKnowledge } from '../render/render-bundle.ts';

export type Command =
  | { readonly name: 'validate'; readonly bundleDir: string; readonly json: boolean }
  | { readonly name: 'render'; readonly bundleDir: string; readonly outDir: string; readonly knowledge: RenderKnowledge }
  | { readonly name: 'report-knowledge'; readonly bundleDir: string; readonly json: boolean }
  | { readonly name: 'help' };

export const USAGE = `usage:
  guide validate <bundle-dir> [--json]
  guide render <bundle-dir> --out <dir> [--knowledge player|full]
  guide report knowledge <bundle-dir> [--json]
`;

export class UsageError extends Error {
  override readonly name = 'UsageError';
}

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
    if (name === 'report') {
      const [topic, ...options] = rest;
      if (topic !== 'knowledge') throw new UsageError('report supports only: report knowledge');
      const { values, positionals } = parseArgs({ args: options, allowPositionals: true, options: { json: { type: 'boolean' } } });
      return { name: 'report-knowledge', bundleDir: single(positionals, 'report knowledge'), json: values.json === true };
    }
  } catch (cause) {
    if (cause instanceof UsageError) throw cause;
    throw new UsageError((cause as Error).message);
  }
  throw new UsageError(`unknown command '${name}'`);
}
