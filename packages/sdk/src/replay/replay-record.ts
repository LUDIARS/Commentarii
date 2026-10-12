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
  /** Optional (SDK 0.4.0): the decider id that recorded the run (replay play re-judges with it). */
  readonly decider?: string;
  /** Optional (SDK 0.4.0): the initial knowledge the decider started from. */
  readonly curriculum?: Curriculum;
  /** ISO 8601 (UTC). */
  readonly started_at: string;
}

/** Initial knowledge kinds (Ingenium R2): runs of different kinds are never compared. */
export const CURRICULUM_KINDS = ['approved-guide', 'fresh-player'] as const;
export type CurriculumKind = (typeof CURRICULUM_KINDS)[number];

export interface Curriculum {
  readonly kind: CurriculumKind;
  /** sha256:<hex> of the initial knowledge. */
  readonly hash: string;
}

/** What the forward model predicts for a plan candidate (SDK 0.4.0), in the arbiter's common currency. */
export interface PlanPrediction {
  readonly p_success?: number;
  readonly progress?: number;
  readonly time_sec?: number;
  readonly resource?: number;
  readonly damage?: number;
  readonly info?: number;
  readonly trust?: number;
}

/** One candidate the decider weighed (design 7.4). Stage 2A deciders may log none. */
export interface DecisionEntry {
  readonly candidate: string;
  readonly utility: number;
  readonly chosen: boolean;
  /** Optional (SDK 0.4.0): the proposer of a plan candidate. */
  readonly proposer?: string;
  /** Optional (SDK 0.4.0): the arbiter's consideration values. */
  readonly parts?: Readonly<Record<string, number>>;
  readonly predicted?: PlanPrediction;
  /** Optional (SDK 0.4.0): the hard constraint that kept the candidate from scoring. */
  readonly rejected?: string;
}

export type Regime = 'calm' | 'threat' | 'critical';
export type ReceiptStatus = 'started' | 'rejected' | 'completed' | 'cancelled';

/** An adapter/2 receipt (inferred: the engine read it from the observations, protocol 1 bridge). */
export interface CommandReceipt {
  readonly command_id: string;
  readonly status: ReceiptStatus;
  readonly reason?: string;
  readonly inferred?: boolean;
}

export interface PlanStepSummary {
  readonly action: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly expect?: string;
  readonly repeat_until?: string;
}

export interface PlanSummary {
  /** plan:<proposer>:t<tick>:<n> */
  readonly plan_id: string;
  readonly proposer: string;
  readonly goal: string;
  readonly steps: readonly PlanStepSummary[];
  readonly valid_while?: string;
  /** Index of the step being carried out. */
  readonly cursor?: number;
}

export interface ProposerTrace {
  readonly plans: number;
  readonly budget?: number;
  readonly used?: number;
  readonly status?: string;
}

/** Why the decider chose what it chose (SDK 0.4.0, tick `planning`). Logical work only, no wall clock. */
export interface PlanningTrace {
  readonly stance: Stance;
  readonly signature: string;
  readonly regime: Regime;
  readonly trust: number;
  readonly budget_row: string;
  readonly replanned: boolean;
  readonly trigger?: string;
  readonly goal?: { readonly source: 'objectives' | 'provisional'; readonly expr: string; readonly clear_guaranteed: boolean };
  readonly proposers: Readonly<Record<string, ProposerTrace>>;
  readonly plan?: PlanSummary;
  readonly experiment?: { readonly action: string; readonly info: number; readonly causes?: readonly string[] };
  readonly receipts?: readonly CommandReceipt[];
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
  /** Optional (SDK 0.4.0): the decision trace of an autonomous decider. */
  readonly planning?: PlanningTrace;
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
