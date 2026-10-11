// `guide run ...` and `guide bench ...` arguments. Errors are thrown as plain Errors;
// parse-command.ts turns them into usage errors.

import { parseArgs } from 'node:util';
import type { ObservationMode, ObservationPurpose } from '@ludiars/commentarii-sdk/types';

export const ADAPTER_KINDS = ['sim', 'stdio', 'render-tap'] as const;
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
  /** Intent-assisted test (design 7.4, spec/feature/engine.md §4.1): the designer's intent scores candidates. Off = player knowledge only. */
  readonly intentAssist: boolean;
  readonly recordPath?: string;
  /** Reflect into this observation file (observations/runs/<run-slug>.jsonl, design 7.5). */
  readonly observePath?: string;
  /** render-tap: the frame stream (a render-tap/1 JSON Lines file, or - for stdin). */
  readonly framesPath?: string;
  /** render-tap: where actions go (stdio = the protocol's action lines on stdout). */
  readonly act: 'stdio' | 'none';
  /** render-tap: the stage the frames show (default: the bundle's first stage). */
  readonly stageId?: string;
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
  readonly intentAssist: boolean;
  readonly withoutTactics: boolean;
  /** bench/<label>.json under the bundle directory (spec/feature/balance-gate.md §2). */
  readonly savePath?: string;
}

export type AutoplayCommand = RunCommand | BenchCommand;

export const AUTOPLAY_USAGE = `  guide run --game <bundle-dir> [--adapter sim|stdio|render-tap] [--frames <frames.jsonl|->] [--act stdio|none] [--stage <stage-id>] [--persona <slug>] [--mode player|omniscient] [--purpose efficiency|coverage] [--seed <n>] [--ticks <n>] [--intent-assist] [--record <out.jsonl>] [--observe <observations.jsonl>]
  guide bench --game <bundle-dir> [--runs <n>] [--persona <slug>] [--mode player|omniscient] [--purpose efficiency|coverage] [--seed <n>] [--ticks <n>] [--intent-assist] [--no-tactics] [--save <bench/label.json>]
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
  'intent-assist': { type: 'boolean' },
} as const;

interface CommonValues {
  readonly game?: string | undefined;
  readonly persona: string;
  readonly mode: string;
  readonly purpose: string;
  readonly seed: string;
  readonly ticks: string;
  readonly 'intent-assist'?: boolean | undefined;
}

function common(values: CommonValues, verb: string): Omit<RunCommand, 'name' | 'adapter' | 'recordPath' | 'act'> {
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
    intentAssist: values['intent-assist'] === true,
  };
}

export function parseRunCommand(args: readonly string[]): RunCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { ...COMMON_OPTIONS, adapter: { type: 'string', default: 'sim' }, record: { type: 'string' }, observe: { type: 'string' }, frames: { type: 'string' }, act: { type: 'string', default: 'none' }, stage: { type: 'string' } },
  });
  if (positionals.length > 0) throw new Error('run takes no positional arguments');
  if (values.adapter !== 'sim' && values.adapter !== 'stdio' && values.adapter !== 'render-tap') throw new Error(`--adapter must be one of: ${ADAPTER_KINDS.join(', ')}`);
  if (values.act !== 'stdio' && values.act !== 'none') throw new Error('--act must be stdio or none');
  if (values.adapter === 'render-tap' && (values.frames === undefined || values.frames === '')) throw new Error('--adapter render-tap needs --frames <frames.jsonl|->');
  if (values.adapter !== 'render-tap' && (values.frames !== undefined || values.act !== 'none' || values.stage !== undefined)) throw new Error('--frames, --act and --stage belong to --adapter render-tap');
  if (values.record === '') throw new Error('--record needs a path');
  if (values.observe === '') throw new Error('--observe needs a path');
  return {
    name: 'run',
    ...common(values, 'run'),
    adapter: values.adapter,
    ...(values.record === undefined ? {} : { recordPath: values.record }),
    ...(values.observe === undefined ? {} : { observePath: values.observe }),
    ...(values.frames === undefined ? {} : { framesPath: values.frames }),
    act: values.act,
    ...(values.stage === undefined ? {} : { stageId: values.stage }),
  };
}

export function parseBenchCommand(args: readonly string[]): BenchCommand {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { ...COMMON_OPTIONS, runs: { type: 'string', default: String(DEFAULT_BENCH_RUNS) }, 'no-tactics': { type: 'boolean' }, save: { type: 'string' } },
  });
  if (positionals.length > 0) throw new Error('bench takes no positional arguments');
  if (values.save !== undefined && !/^[^/\:][^:]*.json$/.test(values.save)) throw new Error('--save needs a relative path ending in .json (under the bundle directory)');
  return {
    name: 'bench',
    ...common(values, 'bench'),
    runs: positiveInteger(values.runs, '--runs'),
    withoutTactics: values['no-tactics'] === true,
    ...(values.save === undefined ? {} : { savePath: values.save }),
  };
}
