// A live bench report -> bench/<label>.json (spec/feature/balance-gate.md §2): the comparability
// key, what was measured (hashes and versions, no names or paths), the metrics with the clear
// rate's 95% interval, and - for coverage benches - the intent classes of the bench runs.

import type { Persona } from '../engine/persona/persona.ts';
import { wilsonInterval } from '../verify/feasibility/sample-evidence.ts';
import { BENCH_RESULT_FORMAT, type BenchDivergences, type BenchResult } from './bench-result.ts';
import { documentHash } from './bundle-hash.ts';
import type { BenchReport } from './summarize-bench.ts';

export interface BenchResultInput {
  readonly report: BenchReport;
  readonly persona: Persona;
  readonly adapter: string;
  readonly intentAssist: boolean;
  readonly manifestVersion: string;
  readonly gameBuilds: readonly string[];
  readonly bundleHash: string;
  readonly overlayHash: string | null;
  readonly engineVersion: string;
  readonly divergences: BenchDivergences | null;
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function percentile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return round(sorted[index] ?? 0);
}

export function toBenchResult(input: BenchResultInput): BenchResult {
  const { report } = input;
  if (report.game_id === null) throw new Error('a bench result needs the bundle game_id');
  if (report.purpose === 'human') throw new Error('a bench never runs with purpose human');
  const cleared = report.per_run.filter((run) => run.result === 'success');
  const times = cleared.map((run) => run.time_sec);
  return {
    format: BENCH_RESULT_FORMAT,
    kind: 'live-balance',
    evidence: 'sim',
    game_id: report.game_id,
    compatibility: {
      adapter: input.adapter,
      persona: input.persona.slug,
      persona_hash: documentHash(input.persona),
      seed: report.seed,
      seeds: report.per_run.map((run) => run.seed),
      runs: report.runs,
      ticks: report.ticks,
      mode: report.mode,
      purpose: report.purpose,
      decision_mode: input.intentAssist ? 'intent-assisted' : 'player-knowledge',
      tactics: report.tactics,
    },
    versions: {
      manifest_version: input.manifestVersion,
      game_builds: [...input.gameBuilds],
      bundle_hash: input.bundleHash,
      overlay_hash: input.overlayHash,
      engine_version: input.engineVersion,
    },
    metrics: {
      clear_rate: report.clear_rate,
      clear_interval: wilsonInterval(cleared.length, report.runs) ?? [0, 1],
      time_p50: percentile(times, 0.5),
      time_p90: percentile(times, 0.9),
      damage_p50: report.damage_taken.p50,
      tactic_share: report.tactic_share,
    },
    divergences: input.divergences,
    per_run: report.per_run.map((run) => ({ seed: run.seed, result: run.result, ticks: run.ticks, time_sec: run.time_sec, damage_taken: run.damage_taken })),
  };
}
