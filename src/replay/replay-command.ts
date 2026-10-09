// `guide replay play|diff ...` arguments -> replay command. Errors are thrown as plain Errors;
// parse-command.ts turns them into usage errors.

import { parseArgs } from 'node:util';
import { DECIDER_IDS, DEFAULT_DECIDER_ID, isDeciderId, type DeciderId } from './decider-registry.ts';
import { DEFAULT_DIFF_LIMIT } from './diff-replays.ts';

export type ReplayCommand =
  | { readonly name: 'replay-play'; readonly runPath: string; readonly until?: number; readonly decider: DeciderId; readonly json: boolean }
  | { readonly name: 'replay-diff'; readonly aPath: string; readonly bPath: string; readonly limit: number; readonly json: boolean };

export const REPLAY_USAGE = `  guide replay play <run.jsonl> [--until <tick>] [--decider ${DECIDER_IDS.join('|')}] [--json]
  guide replay diff <a.jsonl> <b.jsonl> [--limit <n>] [--json]
`;

function nonNegativeInteger(text: string, option: string): number {
  if (!/^\d+$/.test(text)) throw new Error(`${option} must be a non-negative integer`);
  return Number(text);
}

function parsePlay(args: readonly string[]): ReplayCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { until: { type: 'string' }, decider: { type: 'string', default: DEFAULT_DECIDER_ID }, json: { type: 'boolean' } },
  });
  const [runPath, ...extra] = positionals;
  if (runPath === undefined || extra.length > 0) throw new Error('replay play needs exactly one <run.jsonl>');
  if (!isDeciderId(values.decider)) throw new Error(`--decider must be one of: ${DECIDER_IDS.join(', ')}`);
  return {
    name: 'replay-play',
    runPath,
    ...(values.until === undefined ? {} : { until: nonNegativeInteger(values.until, '--until') }),
    decider: values.decider,
    json: values.json === true,
  };
}

function parseDiff(args: readonly string[]): ReplayCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { limit: { type: 'string' }, json: { type: 'boolean' } },
  });
  const [aPath, bPath, ...extra] = positionals;
  if (aPath === undefined || bPath === undefined || extra.length > 0) throw new Error('replay diff needs exactly <a.jsonl> <b.jsonl>');
  const limit = values.limit === undefined ? DEFAULT_DIFF_LIMIT : nonNegativeInteger(values.limit, '--limit');
  return { name: 'replay-diff', aPath, bPath, limit, json: values.json === true };
}

export function parseReplayCommand(args: readonly string[]): ReplayCommand {
  const [verb, ...rest] = args;
  if (verb === 'play') return parsePlay(rest);
  if (verb === 'diff') return parseDiff(rest);
  throw new Error('replay supports only: replay play, replay diff');
}
