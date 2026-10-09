// `guide report plays`: per stage, human runs next to autoplay runs (design 8.3, 14.D) — reach
// rate, time and map routes. Numbers only; drawing is stage 5H.

export interface TimeSpread {
  readonly p50: number;
  readonly p90: number;
}

export interface RouteCount {
  readonly path: readonly string[];
  readonly runs: number;
}

export interface StageSide {
  /** Runs that entered the stage. */
  readonly runs: number;
  /** Runs that got through it. */
  readonly reached: number;
  /** reached / runs, null without runs. */
  readonly reach_rate: number | null;
  /** Seconds in the stage over the runs that got through, null when none did. */
  readonly time_sec: TimeSpread | null;
  /** Most taken routes first (at most MAX_ROUTES). */
  readonly routes: readonly RouteCount[];
}

export interface StageComparison {
  readonly stage: string;
  readonly human: StageSide;
  readonly autoplay: StageSide;
}

export interface PlaysReport {
  readonly game_id: string;
  readonly human: { readonly runs: number; readonly players: number };
  /** Player-mode engine runs; omniscient runs are counted but never compared (principle 2). */
  readonly autoplay: { readonly runs: number; readonly omniscient_excluded: number };
  /** Files under observations/ that are not replay runs of their directory (bundle-relative). */
  readonly skipped_files: readonly string[];
  readonly stages: readonly StageComparison[];
}

export const MAX_ROUTES = 5;
