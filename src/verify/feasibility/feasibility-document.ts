// feasibility/<stage-slug>.json (schema/feasibility.schema.json): the feasibility bands of a
// stage's solutions and the two good-play axes per persona (design 8.5).

import type { FeasibilityThresholds } from './thresholds.ts';

export type Band = 'feasible' | 'extreme' | 'illusory' | 'impossible';
export type StanceOrUnspecified = 'open' | 'refined' | 'mixed' | 'unspecified';

export const FEASIBILITY_DIRECTORY = 'feasibility';

export interface PersonaBand {
  readonly persona: string;
  readonly attempts: number;
  readonly successes: number;
  /** null when the persona made no attempt. */
  readonly success_rate: number | null;
  readonly band: Band;
}

export interface FeasibilitySolution {
  readonly id: string;
  readonly tactics: readonly string[];
  readonly route: readonly string[];
  readonly band: Band;
  readonly visible: boolean;
  readonly by_design?: { readonly rationale: string; readonly decided_by: string };
  readonly intended: readonly string[];
  readonly personas: readonly PersonaBand[];
  readonly evidence_runs: readonly string[];
}

export interface PlayAxes {
  readonly persona: string;
  readonly breadth: number;
  readonly confusion_depth: number;
  readonly convergence: boolean;
  readonly runs: number;
}

export interface FeasibilityDocument {
  readonly stage: string;
  readonly design_stance: StanceOrUnspecified;
  readonly thresholds: FeasibilityThresholds;
  readonly runs: { readonly counted: readonly string[]; readonly ignored_omniscient: readonly string[] };
  readonly solutions: readonly FeasibilitySolution[];
  readonly axes: readonly PlayAxes[];
}

export function feasibilityPath(stageSlug: string): string {
  return `${FEASIBILITY_DIRECTORY}/${stageSlug}.json`;
}
