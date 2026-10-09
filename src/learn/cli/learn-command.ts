// `guide learn ingest ...` and `guide learn consolidate ...` arguments. Errors are thrown as
// plain Errors; parse-command.ts turns them into usage errors.

import { parseArgs } from 'node:util';

export interface LearnIngestCommand {
  readonly name: 'learn-ingest';
  readonly gameDir: string;
  /** observations/runs/<run-slug>.jsonl files written by reflect (guide run --observe). */
  readonly runs: readonly string[];
  readonly json: boolean;
}

export interface LearnConsolidateCommand {
  readonly name: 'learn-consolidate';
  readonly gameDir: string;
  readonly apply: boolean;
  readonly json: boolean;
}

export type LearnCommand = LearnIngestCommand | LearnConsolidateCommand;

export const LEARN_USAGE = `  guide learn ingest --game <bundle-dir> <runs.jsonl...> [--json]
  guide learn consolidate --game <bundle-dir> [--apply] [--json]
`;

function gameDirOf(game: string | undefined, verb: string): string {
  if (game === undefined || game === '') throw new Error(`learn ${verb} needs --game <bundle-dir>`);
  return game;
}

export function parseLearnCommand(args: readonly string[]): LearnCommand {
  const [verb, ...rest] = args;
  if (verb === 'ingest') {
    const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { game: { type: 'string' }, json: { type: 'boolean' } } });
    if (positionals.length === 0) throw new Error('learn ingest needs at least one run file');
    return { name: 'learn-ingest', gameDir: gameDirOf(values.game, verb), runs: positionals, json: values.json === true };
  }
  if (verb === 'consolidate') {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: { game: { type: 'string' }, apply: { type: 'boolean' }, json: { type: 'boolean' } },
    });
    if (positionals.length > 0) throw new Error('learn consolidate takes no positional arguments');
    return { name: 'learn-consolidate', gameDir: gameDirOf(values.game, verb), apply: values.apply === true, json: values.json === true };
  }
  throw new Error('learn supports: learn ingest, learn consolidate');
}
