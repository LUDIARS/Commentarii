// Feasibility thresholds (spec/feature/intent-verify.md 6.3): manifest feasibility.thresholds
// over the defaults, field by field.

import type { Manifest } from '../../domain/documents.ts';

export interface FeasibilityThresholds {
  /** Success rate a solution needs from every judged persona to be feasible. */
  readonly feasible_success: number;
  /** Attempts a persona needs to be judged. */
  readonly min_runs: number;
  /** Weight of a failed attempt spent on an illusory solution in confusion depth. */
  readonly illusory_weight: number;
  /** Seconds in one node before the rest counts as stalling. */
  readonly stall_after_sec: number;
  /** Confusion depth per stalled second. */
  readonly stall_weight: number;
  /**
   * A solution with no success is called illusory only when the 95% upper bound of its success
   * rate is below this (enough finished attempts); otherwise it is insufficient-evidence.
   */
  readonly zero_success_upper: number;
}

export const DEFAULT_THRESHOLDS: FeasibilityThresholds = {
  feasible_success: 0.5,
  min_runs: 1,
  illusory_weight: 3,
  stall_after_sec: 10,
  stall_weight: 0.1,
  zero_success_upper: 0.2,
};

export function thresholdsOf(manifest: Manifest | undefined): FeasibilityThresholds {
  const declared = manifest?.feasibility?.thresholds ?? {};
  const pick = (key: keyof FeasibilityThresholds): number => {
    const value = declared[key];
    return typeof value === 'number' ? value : DEFAULT_THRESHOLDS[key];
  };
  return {
    feasible_success: pick('feasible_success'),
    min_runs: pick('min_runs'),
    illusory_weight: pick('illusory_weight'),
    stall_after_sec: pick('stall_after_sec'),
    stall_weight: pick('stall_weight'),
    zero_success_upper: pick('zero_success_upper'),
  };
}
