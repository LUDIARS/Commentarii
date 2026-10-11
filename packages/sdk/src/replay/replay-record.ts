// Lines of replay/<run-id>.jsonl (design 14.A, schema/replay.schema.json):
// one header, then one tick line per engine tick, then one footer.

import type { ObservationFieldDeclaration } from '../observation/observation-fields.ts';
import type { ObservationFrame, ObservationMode, ObservationPurpose } from './observation-frame.ts';
import type { ReplayAction } from './replay-action.ts';

/** Engine stances (spec/plan/2026-10-11-ingenium-integrated-design.md §3). */
export const STANCES = ['autonomous', 'guided', 'hybrid'] as const;
export type Stance = (typeof STANCES)[number];

/** The engine that recorded a run. */
export interface ReplayEngine {
  readonly name: string;
  readonly version: string;
}

export interface ReplayHeader {
  readonly type: 'header';
  /** run:<slug> */
  readonly run_id: string;
  readonly seed: number | string;
  readonly game_id: string;
  readonly manifest_version: string;
  readonly adapter_id: string;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  /** human: imported from a human play log (design 14.D); absent for engine runs. */
  readonly source?: 'human';
  readonly persona?: string;
  /**
   * intent-assisted: the engine scored candidates with the designer's intent (spec/feature/engine.md §4.1).
   * Absent = player knowledge only. Such runs never count as a persona's (human-like) ability.
   */
  readonly decision_mode?: 'intent-assisted';
  /**
   * The game's observation field declarations the run was recorded under (manifest
   * observation.fields, spec/feature/observation-boundary.md). Absent in recordings made before
   * the boundary registry: those are checked against the base registry only.
   */
  readonly observation_fields?: readonly ObservationFieldDeclaration[];
  /** The recording engine (Ingenium R0-B); absent in recordings made before the engine moved. */
  readonly engine?: ReplayEngine;
  /** @ludiars/commentarii-sdk version the engine read the bundle with. */
  readonly sdk_version?: string;
  /** bundle format_version the engine reads (EXPORT_FORMAT_VERSION). */
  readonly bundle_format?: number;
  /** Content hash of the canonical bundle the engine decided from. */
  readonly bundle_hash?: string;
  readonly stance?: Stance;
  /** ISO 8601 (UTC). */
  readonly started_at: string;
}

/** One candidate the decider weighed (design 7.4). Stage 2A deciders may log none. */
export interface DecisionEntry {
  readonly candidate: string;
  readonly utility: number;
  readonly chosen: boolean;
}

export interface ReplayTick {
  readonly type: 'tick';
  readonly tick: number;
  readonly t: number;
  readonly observation: ObservationFrame;
  readonly decision: readonly DecisionEntry[];
  readonly action: ReplayAction;
  /** Optional (SDK 0.3.0): the decider's belief and affordances at this tick. */
  readonly model?: ModelSummary;
}

export type AffordanceClass = 'now' | 'uncertain' | 'reachable' | 'not_found' | 'impossible';

export interface ModelSummary {
  readonly belief?: {
    readonly tracked: number;
    readonly unknown: number;
    readonly intervals?: Readonly<Record<string, readonly [number, number]>>;
  };
  readonly affordances?: Readonly<Partial<Record<AffordanceClass, readonly string[]>>>;
}

export type ReplayResult = 'success' | 'fail' | 'abort';

export interface ReplayFooter {
  readonly type: 'footer';
  readonly ended_at: string;
  readonly result: ReplayResult;
  readonly summary: Readonly<Record<string, unknown>>;
}

export type ReplayLine = ReplayHeader | ReplayTick | ReplayFooter;

export interface ReplayRun {
  readonly header: ReplayHeader;
  readonly ticks: readonly ReplayTick[];
  readonly footer: ReplayFooter;
}

/** The candidate marked chosen, if the decider logged one. */
export function chosenCandidate(tick: ReplayTick): string | undefined {
  return tick.decision.find((entry) => entry.chosen)?.candidate;
}
