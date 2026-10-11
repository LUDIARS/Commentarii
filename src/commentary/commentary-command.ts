// `guide commentary <run.jsonl> --game <bundle-dir> [--narrator <program>] [--out <dir>]`.
// Writes <out>/<run>.md and the exact input given to the narrator as <run>.input.json;
// <out> defaults to <bundle-dir>/observations/commentary (design 14.J: never mixed into the canon).

import { join } from 'node:path';
import { parseArgs } from 'node:util';

export interface CommentaryCommand {
  readonly name: 'commentary';
  readonly runPath: string;
  readonly gameDir: string;
  readonly outDir: string;
  /** External narrator program: reads the commentary input JSON on stdin, writes prose to stdout. */
  readonly narrator?: string;
}

export const COMMENTARY_USAGE = `  guide commentary <run.jsonl> --game <bundle-dir> [--narrator <program>] [--out <dir>]
`;

export function parseCommentaryCommand(args: readonly string[]): CommentaryCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { game: { type: 'string' }, narrator: { type: 'string' }, out: { type: 'string' } },
  });
  const [runPath, ...extra] = positionals;
  if (runPath === undefined || extra.length > 0) throw new Error('commentary needs exactly one <run.jsonl>');
  if (values.game === undefined || values.game === '') throw new Error('commentary needs --game <bundle-dir>');
  if (values.narrator === '') throw new Error('--narrator needs a program');
  return {
    name: 'commentary',
    runPath,
    gameDir: values.game,
    outDir: values.out ?? join(values.game, 'observations', 'commentary'),
    ...(values.narrator === undefined ? {} : { narrator: values.narrator }),
  };
}
