// bench/<label>.json (schema/bench-result.schema.json, spec/feature/balance-gate.md): what a live
// bench measured, with everything needed to know whether two results may be compared (Astra
// review P1-6). It is a live balance result of the sim (evidence: sim): a statement about the
// engine on the simulated game, not about people and not about the real build.

export const BENCH_RESULT_FORMAT = 'bench-result/1';

/**
 * Two results are comparable only when all of these are equal: the same personas on the same
 * seeds, budget, mode, purpose and decision mode, through the same adapter. What may differ
 * between base and head is the thing being measured: the guide, the overlay, the engine, the build.
 */
export interface BenchCompatibility {
  readonly adapter: string;
  readonly persona: string;
  readonly persona_hash: string;
  readonly seed: number | string;
  readonly seeds: readonly number[];
  readonly runs: number;
  readonly ticks: number;
  readonly mode: 'player' | 'omniscient';
  readonly purpose: 'efficiency' | 'coverage';
  readonly decision_mode: 'player-knowledge' | 'intent-assisted';
  readonly tactics: 'guide' | 'none';
}

/** What was measured (allowed to differ between base and head). */
export interface BenchVersions {
  readonly manifest_version: string;
  readonly game_builds: readonly string[];
  readonly bundle_hash: string;
  readonly overlay_hash: string | null;
  readonly engine_version: string;
}

export interface BenchMetrics {
  readonly clear_rate: number;
  /** 95% Wilson interval of the clear rate. */
  readonly clear_interval: readonly [number, number];
  readonly time_p50: number | null;
  readonly time_p90: number | null;
  readonly damage_p50: number;
  readonly tactic_share: Readonly<Record<string, number>>;
}

export interface BenchDivergences {
  /** Intent class -> number of intended items in that class, over all stages. */
  readonly classes: Readonly<Record<string, number>>;
  /** IDs of open undesirable divergences. */
  readonly undesirable: readonly string[];
}

export interface BenchResultRun {
  readonly seed: number;
  readonly result: 'success' | 'fail' | 'abort';
  readonly ticks: number;
  readonly time_sec: number;
  readonly damage_taken: number;
}

export interface BenchResult {
  readonly format: typeof BENCH_RESULT_FORMAT;
  readonly kind: 'live-balance';
  readonly evidence: 'sim';
  readonly game_id: string;
  readonly compatibility: BenchCompatibility;
  readonly versions: BenchVersions;
  readonly metrics: BenchMetrics;
  /** Intent verification of the bench runs (coverage benches only, else null). */
  readonly divergences: BenchDivergences | null;
  readonly per_run: readonly BenchResultRun[];
}
