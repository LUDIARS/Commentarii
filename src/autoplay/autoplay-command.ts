// `guide run ...` and `guide bench ...` arguments. Errors are thrown as plain Errors;
// parse-command.ts turns them into usage errors.

import { parseArgs } from 'node:util';
import type { ObservationMode, ObservationPurpose } from '../replay/observation-frame.ts';

export const ADAPTER_KINDS = ['sim', 'stdio'] as const;
export type AdapterKind = (typeof ADAPTER_KINDS)[number];

export const DEFAULT_PERSONA = 'expert';
export const DEFAULT_SEED = 1;
/** 120 s of the sim's 0.1 s ticks. */
export const DEFAULT_TICKS = 1200;
export const DEFAULT_BENCH_RUNS = 20;

export interface RunCommand {
  readonly name: 'run';
  readonly gameDir: string;
  readonly adapter: AdapterKind;
  readonly persona: string;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  readonly seed: number;
  readonly ticks: number;
  readonly recordPath?: string;
  /** Reflect into this observation file (observations/runs/<run-slug>.jsonl, design 7.5). */
  readonly observePath?: string;
}

export interface BenchCommand {
  readonly name: 'bench';
  readonly gameDir: string;
  readonly runs: number;
  readonly persona: string;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  readonly seed: number;
  readonly ticks: number;
  readonly withoutTactics: boolean;
}

export type AutoplayCommand = RunCommand | BenchCommand;

export const AUTOPLAY_USAGE = `  guide run --game <bundle-dir> [--adapter sim|stdio] [--persona <slug>] [--mode player|omniscient] [--purpose efficiency|coverage] [--seed <n>] [--ticks <n>] [--record <out.jsonl>] [--observe <observations.jsonl>]
  guide bench --game <bundle-dir> [--runs <n>] [--persona <slug>] [--mode player|omniscient] [--purpose efficiency|coverage] [--seed <n>] [--ticks <n>] [--no-tactics]
`;

function nonNegativeInteger(text: string, option: string): number {
  if (!/^\d+$/.test(text)) throw new Error(`${option} must be a non-negative integer`);
  return Number(text);
}

function positiveInteger(text: string, option: string): number {
  const value = nonNegativeInteger(text, option);
  if (value === 0) throw new Error(`${option} must be at least 1`);
  return value;
}

const COMMON_OPTIONS = {
  game: { type: 'string' },
  persona: { type: 'string', default: DEFAULT_PERSONA },
  mode: { type: 'string', default: 'player' },
  purpose: { type: 'string', default: 'efficiency' },
  seed: { type: 'string', default: String(DEFAULT_SEED) },
  ticks: { type: 'string', default: String(DEFAULT_TICKS) },
} as const;

interface CommonValues {
  readonly game?: string | undefined;
  readonly persona: string;
  readonly mode: string;
  readonly purpose: string;
  readonly seed: string;
  readonly ticks: string;
}

function common(values: CommonValues, verb: string): Omit<RunCommand, 'name' | 'adapter' | 'recordPath'> {
  if (values.game === undefined || values.game === '') throw new Error(`${verb} needs --game <bundle-dir>`);
  if (values.mode !== 'player' && values.mode !== 'omniscient') throw new Error('--mode must be player or omniscient');
  if (values.purpose !== 'efficiency' && values.purpose !== 'coverage') throw new Error('--purpose must be efficiency or coverage');
  return {
    gameDir: values.game,
    persona: values.persona,
    mode: values.mode,
    purpose: values.purpose,
    seed: nonNegativeInteger(values.seed, '--seed'),
    ticks: positiveInteger(values.ticks, '--ticks'),
  };
}

export function parseRunCommand(args: readonly string[]): RunCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { ...COMMON_OPTIONS, adapter: { type: 'string', default: 'sim' }, record: { type: 'string' }, observe: { type: 'string' } },
  });
  if (positionals.length > 0) throw new Error('run takes no positional arguments');
  if (values.adapter !== 'sim' && values.adapter !== 'stdio') throw new Error(`--adapter must be one of: ${ADAPTER_KINDS.join(', ')}`);
  if (values.record === '') throw new Error('--record needs a path');
  if (values.observe === '') throw new Error('--observe needs a path');
  return {
    name: 'run',
    ...common(values, 'run'),
    adapter: values.adapter,
    ...(values.record === undefined ? {} : { recordPath: values.record }),
    ...(values.observe === undefined ? {} : { observePath: values.observe }),
  };
}

export function parseBenchCommand(args: readonly string[]): BenchCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { ...COMMON_OPTIONS, runs: { type: 'string', default: String(DEFAULT_BENCH_RUNS) }, 'no-tactics': { type: 'boolean' } },
  });
  if (positionals.length > 0) throw new Error('bench takes no positional arguments');
  return { name: 'bench', ...common(values, 'bench'), runs: positiveInteger(values.runs, '--runs'), withoutTactics: values['no-tactics'] === true };
}
