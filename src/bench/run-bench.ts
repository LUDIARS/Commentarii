// `guide bench` (minimal form, design 14.C): N seeded runs of the engine against the sim, and
// their clear rate, time, damage taken and the distribution of chosen candidates. Run i uses
// the seed derived from (seed, i), so a bench is reproducible as a whole and run by run.
// Comparing against thresholds is stage 5C; this only measures.

import type { Bundle } from '../bundle/bundle.ts';
import { createSimAdapter } from '../adapters/sim/sim-adapter.ts';
import type { SimConfig } from '../adapters/sim/sim-config.ts';
import { runDriver } from '../engine/driver.ts';
import type { Persona } from '../engine/persona/persona.ts';
import { deriveSeed } from '../engine/rng.ts';
import { createUtilityBtDecider } from '../engine/utility-bt-decider.ts';
import type { ObservationMode, ObservationPurpose } from '../replay/observation-frame.ts';
import type { ReplayFooter, ReplayHeader, ReplayRun, ReplayTick } from '../replay/replay-record.ts';
import type { ReplayLineWriter } from '../replay/recording-sink.ts';
import { summarizeBench, type BenchReport, type BenchRun } from './summarize-bench.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:7c3f1b7b */
import augurContract_38d5b9f8 from '../contracts/run-bench.contract.ts'; /* augur-inject:contract-predicate:39493530 */

export interface BenchOptions {
  readonly bundle: Bundle;
  readonly persona: Persona;
  readonly seed: number | string;
  readonly runs: number;
  readonly ticks: number;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  /** Measure the engine with the guide's tactics removed (generic actions only). */
  readonly withoutTactics?: boolean;
  /** Intent-assisted test (spec/feature/engine.md §4.1); absent = player knowledge only. */
  readonly intentAssist?: boolean;
  readonly simConfig?: SimConfig;
  /** Receives every run as a recorded replay (coverage benches feed intent verification). */
  readonly onRun?: (run: ReplayRun) => void;
}

/** Collects the recorder's lines in memory and reads them back as one run. */
function memoryRecording(): { writer: ReplayLineWriter; run(): ReplayRun } {
  const lines: string[] = [];
  return {
    writer: { append: async (line) => void lines.push(line) },
    run() {
      const parsed = lines.map((line) => JSON.parse(line) as ReplayHeader | ReplayTick | ReplayFooter);
      return { header: parsed[0] as ReplayHeader, ticks: parsed.slice(1, -1) as ReplayTick[], footer: parsed.at(-1) as ReplayFooter };
    },
  };
}

/** Seed of run `index` of a bench started with `seed`. */
export function benchRunSeed(seed: number | string, index: number): number {
  return deriveSeed(seed, `bench-run-${index}`);
}

export async function runBench(options: BenchOptions): Promise<BenchReport> {
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error(`runs must be a positive integer, got ${options.runs}`);
  const bundle = options.withoutTactics === true ? { ...options.bundle, tactics: [] } : options.bundle;
  const runs: BenchRun[] = [];
  for (let index = 0; index < options.runs; index += 1) {
    const seed = benchRunSeed(options.seed, index);
    const adapter = createSimAdapter({
      bundle,
      mode: options.mode,
      purpose: options.purpose,
      seed: deriveSeed(seed, 'sim'),
      ...(options.simConfig ? { config: options.simConfig } : {}),
    });
    const decider = createUtilityBtDecider({ bundle, persona: options.persona, intentAssist: options.intentAssist === true }, seed);
    const recording = options.onRun === undefined ? undefined : memoryRecording();
    const record =
      recording === undefined
        ? {}
        : {
            record: {
              writer: recording.writer,
              header: { run_id: `run:bench-${options.persona.slug}-${index}`, seed, manifest_version: options.bundle.manifest?.doc.version ?? '0', purpose: options.purpose, persona: options.persona.slug, ...(options.intentAssist === true ? { decision_mode: 'intent-assisted' as const } : {}) },
              now: () => new Date(0),
            },
          };
    const report = await runDriver({ adapter, decider, mode: options.mode, observationFields: options.bundle.manifest?.doc.observation?.fields ?? [], maxTicks: options.ticks, ...record });
    if (recording !== undefined) options.onRun?.(recording.run());
    const stats = adapter.stats();
    runs.push({ seed, result: report.result, ticks: report.ticks, time_sec: stats.time_sec, damage_taken: stats.damage_taken, chosen: report.chosen });
  }
  return summarizeBench(options, runs);
}
// @ts-expect-error augur-inject
runBench = contract(runBench, { ...augurContract_38d5b9f8, contractId: 'C-22', mode: 'observe', sample: 1, where: 'src/bench/run-bench.ts:34', rule: 'contract-wrap', id: '38d5b9f8' }); /* augur-inject:contract-wrap:38d5b9f8 */
