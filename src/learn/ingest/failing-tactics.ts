// "失敗が続く定石" (design 6 learn ingest): tactics whose latest judged runs are failures in a
// row, at least FAILING_STREAK of them, with their success rate and broken expects.

import type { Overlay } from '../overlay/overlay.ts';

export const FAILING_STREAK = 3;

export interface FailingTactic {
  readonly tactic: string;
  /** Failures in a row at the end of the samples. */
  readonly streak: number;
  readonly runs: number;
  readonly success: number;
  readonly mismatches: number;
}

function trailingFailures(outcomes: readonly string[]): number {
  let streak = 0;
  for (let index = outcomes.length - 1; index >= 0 && outcomes[index] === 'failure'; index -= 1) streak += 1;
  return streak;
}

export function findFailingTactics(overlay: Overlay): FailingTactic[] {
  const mismatches = new Map(overlay.mismatches.map((entry) => [entry.tactic, entry.count]));
  return overlay.tactics
    .map((entry) => ({
      tactic: entry.tactic,
      streak: trailingFailures(entry.samples.map((sample) => sample.outcome)),
      runs: entry.metrics.runs,
      success: entry.metrics.success,
      mismatches: mismatches.get(entry.tactic) ?? 0,
    }))
    .filter((entry) => entry.streak >= FAILING_STREAK);
}
