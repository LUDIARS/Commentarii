// `guide bench compare ...`, `guide bench replay ...` and `guide gate balance ...` arguments
// (spec/feature/balance-gate.md). Errors are thrown as plain Errors; parse-command.ts turns them
// into usage errors.

import { parseArgs } from 'node:util';
import type { FailOn } from '../gate-balance.ts';

export interface BenchCompareCommand {
  readonly name: 'bench-compare';
  readonly base: string;
  readonly head: string;
  /** Bundle whose manifest bench.thresholds apply (defaults otherwise). */
  readonly gameDir?: string;
  readonly json: boolean;
}

export interface BenchReplayCommand {
  readonly name: 'bench-replay';
  readonly gameDir: string;
  readonly runs: readonly string[];
  readonly json: boolean;
}

export interface GateBalanceCommand {
  readonly name: 'gate-balance';
  readonly gameDir: string;
  readonly base: string;
  readonly head: string;
  readonly failOn: FailOn;
  readonly json: boolean;
}

export type GateCommand = BenchCompareCommand | BenchReplayCommand | GateBalanceCommand;

export const GATE_USAGE = `  guide bench compare <base.json> <head.json> [--game <bundle-dir>] [--json]
  guide bench replay --game <bundle-dir> --runs <dir|files...> [--json]
  guide gate balance --game <bundle-dir> --base <base.json> --head <head.json> [--fail-on block|none] [--json]
`;

function required(value: string | undefined, flag: string, verb: string): string {
  if (value === undefined || value === '') throw new Error(`${verb} needs ${flag}`);
  return value;
}

export function parseBenchCompare(args: readonly string[]): BenchCompareCommand {
  const { values, positionals } = parseArgs({ args: [...args], allowPositionals: true, options: { game: { type: 'string' }, json: { type: 'boolean' } } });
  const [base, head, ...extra] = positionals;
  if (base === undefined || head === undefined || extra.length > 0) throw new Error('bench compare needs exactly <base.json> <head.json>');
  return { name: 'bench-compare', base, head, ...(values.game === undefined ? {} : { gameDir: values.game }), json: values.json === true };
}

export function parseBenchReplay(args: readonly string[]): BenchReplayCommand {
  const { values, positionals } = parseArgs({ args: [...args], allowPositionals: true, options: { game: { type: 'string' }, runs: { type: 'string', multiple: true }, json: { type: 'boolean' } } });
  const runs = [...(values.runs ?? []), ...positionals];
  if (runs.length === 0) throw new Error('bench replay needs --runs <dir|files...>');
  return { name: 'bench-replay', gameDir: required(values.game, '--game <bundle-dir>', 'bench replay'), runs, json: values.json === true };
}

export function parseGateCommand(args: readonly string[]): GateBalanceCommand {
  const [topic, ...rest] = args;
  if (topic !== 'balance') throw new Error('gate supports: gate balance');
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: { game: { type: 'string' }, base: { type: 'string' }, head: { type: 'string' }, 'fail-on': { type: 'string', default: 'block' }, json: { type: 'boolean' } },
  });
  if (positionals.length > 0) throw new Error('gate balance takes no positional arguments');
  const failOn = values['fail-on'];
  if (failOn !== 'block' && failOn !== 'none') throw new Error('--fail-on must be block or none');
  return {
    name: 'gate-balance',
    gameDir: required(values.game, '--game <bundle-dir>', 'gate balance'),
    base: required(values.base, '--base <base.json>', 'gate balance'),
    head: required(values.head, '--head <head.json>', 'gate balance'),
    failOn,
    json: values.json === true,
  };
}
