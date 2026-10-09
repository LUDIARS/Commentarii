// feasibility/<stage-slug>.json (schema/feasibility.schema.json): the feasibility bands of a
// stage's solutions and the two good-play axes per persona (design 8.5).

import type { SampleEvidence } from './sample-evidence.ts';
import type { FeasibilityThresholds } from './thresholds.ts';

/**
 * The four bands of design 8.5 plus skill-gated (some persona feasible, another judged persona
 * below: expert succeeds / novice fails), and two measured states outside the classification
 * (Astra review P1-3): insufficient-evidence (no success, but too few finished attempts or no
 * proof to call it illusory / impossible) and not-observed (no finished attempt at all).
 */
export type Band = 'feasible' | 'skill-gated' | 'extreme' | 'illusory' | 'impossible' | 'insufficient-evidence' | 'not-observed';

/** Bands that are classifications (a solution in one of the other states is not classified yet). */
export const CLASSIFIED_BANDS: readonly Band[] = ['feasible', 'skill-gated', 'extreme', 'illusory', 'impossible'];
export type StanceOrUnspecified = 'open' | 'refined' | 'mixed' | 'unspecified';

export const FEASIBILITY_DIRECTORY = 'feasibility';

export interface PersonaBand {
  readonly persona: string;
  readonly attempts: number;
  readonly successes: number;
  /** null when the persona made no attempt. */
  readonly success_rate: number | null;
  readonly band: Band;
  /** The sample behind the band (finished attempts, interval, seeds, budget). */
  readonly evidence: SampleEvidence;
}

export interface FeasibilitySolution {
  readonly id: string;
  readonly tactics: readonly string[];
  readonly route: readonly string[];
  readonly band: Band;
  /** The sample behind the band, over every persona. */
  readonly evidence: SampleEvidence;
  /** The map proof that made the solution impossible. */
  readonly unwalkable?: string;
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
  /** Measured totals behind confusion_depth (observation, not interpretation). */
  readonly observed: { readonly failures: number; readonly round_trips: number; readonly stall_sec: number; readonly off_route_nodes: number };
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
