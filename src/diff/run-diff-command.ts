// Runs `guide diff --explain`: exports both guides with the same knowledge, diffs them by meaning,
// prints Markdown (or JSON) to stdout or writes it to --out. Schema-invalid files are left out of
// both sides, as export does, and reported on stderr.

import { basename, dirname } from 'node:path';
import { EXIT_OK, type CliIo } from '../cli/cli-io.ts';
import { buildExport } from '../export/build-export.ts';
import type { DiffCommand } from './diff-command.ts';
import { formatDiffMarkdown } from './format-diff-markdown.ts';
import { semanticDiff } from './semantic-diff.ts';

type DiffIo = Pick<CliIo, 'stdout' | 'stderr' | 'openBundle' | 'writeFiles'>;

export async function runDiffCommand(command: DiffCommand, io: DiffIo): Promise<number> {
  const exports = [];
  for (const directory of [command.beforeDir, command.afterDir]) {
    const load = await io.openBundle(directory);
    if (load.issues.length > 0) io.stderr(`guide diff: ${directory}: ${load.issues.length} schema issue(s); invalid files are left out\n`);
    exports.push(buildExport(load, { knowledge: command.knowledge, target: 'runtime' }));
  }
  const [before, after] = exports;
  if (before === undefined || after === undefined) throw new Error('unreachable: two guides were exported');
  const diff = semanticDiff(before, after);
  const text = command.json ? `${JSON.stringify(diff, null, 2)}\n` : formatDiffMarkdown(diff);
  if (command.outFile === undefined) {
    io.stdout(text);
  } else {
    await io.writeFiles(dirname(command.outFile), new Map([[basename(command.outFile), text]]));
    io.stderr(`guide diff: wrote ${diff.changes.length} change(s) to ${command.outFile} (knowledge=${command.knowledge})\n`);
  }
  return EXIT_OK;
}
