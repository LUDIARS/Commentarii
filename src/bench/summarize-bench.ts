// Bench runs -> the JSON report of `guide bench`.

import type { ObservationMode, ObservationPurpose } from '../replay/observation-frame.ts';
import type { ReplayResult } from '../replay/replay-record.ts';

export interface BenchRun {
  readonly seed: number;
  readonly result: ReplayResult;
  readonly ticks: number;
  readonly time_sec: number;
  readonly damage_taken: number;
  /** Candidate ID -> ticks chosen. */
  readonly chosen: Readonly<Record<string, number>>;
}

export interface Spread {
  readonly mean: number;
  readonly p50: number;
}

export interface BenchReport {
  readonly game_id: string | null;
  readonly persona: string;
  readonly seed: number | string;
  readonly runs: number;
  readonly ticks: number;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  readonly tactics: 'guide' | 'none';
  /** Share of runs that ended in success. */
  readonly clear_rate: number;
  /** Seconds to clear, over cleared runs (null when none cleared). */
  readonly time_sec: Spread | null;
  readonly damage_taken: Spread;
  /** Candidate ID -> share of all decided ticks on which it was chosen. */
  readonly candidate_share: Readonly<Record<string, number>>;
  /** Tactic ID -> share of decided ticks (guide tactics only). */
  readonly tactic_share: Readonly<Record<string, number>>;
  /** Share of decided ticks spent on exploration candidates (explore:* / variant:*). */
  readonly exploration_share: number;
  readonly per_run: readonly BenchRun[];
}

interface SummaryOptions {
  readonly bundle: { readonly manifest?: { readonly doc: { readonly game_id: string } } };
  readonly persona: { readonly slug: string };
  readonly seed: number | string;
  readonly ticks: number;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  readonly withoutTactics?: boolean;
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function spread(values: readonly number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const middle = Math.floor((sorted.length - 1) / 2);
  const p50 = sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle] ?? 0) + (sorted[middle + 1] ?? 0)) / 2;
  return { mean: round(mean), p50: round(p50) };
}

export function isExplorationCandidate(id: string): boolean {
  return id.startsWith('explore:') || id.startsWith('variant:');
}

export function summarizeBench(options: SummaryOptions, runs: readonly BenchRun[]): BenchReport {
  const totals: Record<string, number> = {};
  for (const run of runs) for (const [id, count] of Object.entries(run.chosen)) totals[id] = (totals[id] ?? 0) + count;
  const decided = runs.reduce((sum, run) => sum + run.ticks, 0);
  const share = (count: number): number => (decided === 0 ? 0 : round(count / decided));
  const candidateShare: Record<string, number> = {};
  const tacticShare: Record<string, number> = {};
  let exploring = 0;
  for (const id of Object.keys(totals).sort()) {
    const count = totals[id] ?? 0;
    candidateShare[id] = share(count);
    if (id.startsWith('tactic:')) tacticShare[id] = share(count);
    if (isExplorationCandidate(id)) exploring += count;
  }
  const cleared = runs.filter((run) => run.result === 'success');
  return {
    game_id: options.bundle.manifest?.doc.game_id ?? null,
    persona: options.persona.slug,
    seed: options.seed,
    runs: runs.length,
    ticks: options.ticks,
    mode: options.mode,
    purpose: options.purpose,
    tactics: options.withoutTactics === true ? 'none' : 'guide',
    clear_rate: round(cleared.length / runs.length),
    time_sec: cleared.length === 0 ? null : spread(cleared.map((run) => run.time_sec)),
    damage_taken: spread(runs.map((run) => run.damage_taken)),
    candidate_share: candidateShare,
    tactic_share: tacticShare,
    exploration_share: share(exploring),
    per_run: runs,
  };
}
