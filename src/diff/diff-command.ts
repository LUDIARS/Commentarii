// `guide diff --explain <before-dir> <after-dir> [--knowledge player|full] [--json] [--out <file>]`.
// --explain is required: the plain file diff is git's job, this command only explains meaning.

import { parseArgs } from 'node:util';
import type { ExportKnowledge } from '../export/exported-bundle.ts';

export interface DiffCommand {
  readonly name: 'diff-explain';
  readonly beforeDir: string;
  readonly afterDir: string;
  readonly knowledge: ExportKnowledge;
  readonly json: boolean;
  readonly outFile?: string;
}

export const DIFF_USAGE = `  guide diff --explain <before-dir> <after-dir> [--knowledge player|full] [--json] [--out <file>]
`;

export function parseDiffCommand(args: readonly string[]): DiffCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      explain: { type: 'boolean' },
      knowledge: { type: 'string', default: 'player' },
      json: { type: 'boolean' },
      out: { type: 'string' },
    },
  });
  if (values.explain !== true) throw new Error('diff needs --explain (the file diff is git\'s job)');
  const [beforeDir, afterDir, ...extra] = positionals;
  if (beforeDir === undefined || afterDir === undefined || extra.length > 0) throw new Error('diff --explain needs exactly <before-dir> <after-dir>');
  if (values.knowledge !== 'player' && values.knowledge !== 'full') throw new Error('--knowledge must be player or full');
  if (values.out === '') throw new Error('--out needs a file');
  return {
    name: 'diff-explain',
    beforeDir,
    afterDir,
    knowledge: values.knowledge,
    json: values.json === true,
    ...(values.out === undefined ? {} : { outFile: values.out }),
  };
}
