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

export interface LearnApproveCommand {
  readonly name: 'learn-approve';
  readonly gameDir: string;
  readonly proposal: string;
  readonly by: string;
  readonly reason: string;
}

export type LearnCommand = LearnIngestCommand | LearnConsolidateCommand | LearnApproveCommand;

export const LEARN_USAGE = `  guide learn ingest --game <bundle-dir> <runs.jsonl...> [--json]
  guide learn consolidate --game <bundle-dir> [--apply] [--json]
  guide learn approve --game <bundle-dir> --proposal <id> --by <name> --reason <text>
`;

function requiredText(value: string | undefined, flag: string): string {
  if (value === undefined || value.trim() === '') throw new Error(`learn approve needs ${flag}`);
  return value;
}

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
  if (verb === 'approve') {
    const { values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: { game: { type: 'string' }, proposal: { type: 'string' }, by: { type: 'string' }, reason: { type: 'string' } },
    });
    if (positionals.length > 0) throw new Error('learn approve takes no positional arguments');
    return {
      name: 'learn-approve',
      gameDir: gameDirOf(values.game, verb),
      proposal: requiredText(values.proposal, '--proposal <id>'),
      by: requiredText(values.by, '--by <name>'),
      reason: requiredText(values.reason, '--reason <text>'),
    };
  }
  throw new Error('learn supports: learn ingest, learn consolidate, learn approve');
}
