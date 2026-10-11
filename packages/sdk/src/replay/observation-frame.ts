// The complete per-tick Observation (design 7.2) an adapter hands to the engine. Distinct from
// the one-line overlay observation of design 4.4 (schema/observation.schema.json): a frame is
// what the engine saw, the overlay line is what reflect concluded. Shape: schema/observation-frame.schema.json.

import type { Knowledge } from '../domain/knowledge.ts';

export type ObservationMode = 'player' | 'omniscient';
/** human: a human play imported by guide import plays (design 14.D). */
export type ObservationPurpose = 'efficiency' | 'coverage' | 'human';
/** telemetry: converted from a human play log (design 14.D). */
export type ObservationSource = 'game-api' | 'render-tap' | 'pixels' | 'telemetry';

/** A value read from the game together with its knowledge boundary. */
export interface ObservedValue {
  readonly value: unknown;
  readonly knowledge: Knowledge;
}

export type Vector3 = readonly [number, number, number];

export interface ObservedSelf {
  readonly pos?: Vector3;
  readonly hp?: ObservedValue;
  readonly resources?: Readonly<Record<string, number | ObservedValue>>;
}

export interface ObservedEntity {
  /** Absent when the adapter could not identify the entity (recorded as unknown). */
  readonly entity?: string;
  readonly instance: number;
  readonly pos?: Vector3;
  /** Screen bounding box [x, y, width, height]. */
  readonly screen?: readonly [number, number, number, number];
  readonly state_guess?: string;
  readonly confidence?: number;
}

export interface ObservedStage {
  readonly id: string;
  readonly elapsed?: number;
  readonly node?: string;
}

export interface ObservedEvent {
  readonly kind: string;
  readonly [key: string]: unknown;
}

export interface ObservationFrame {
  readonly tick: number;
  readonly t: number;
  readonly source: ObservationSource;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  readonly self: ObservedSelf;
  readonly entities: readonly ObservedEntity[];
  readonly stage: ObservedStage;
  readonly events: readonly ObservedEvent[];
  readonly extra?: Readonly<Record<string, unknown>>;
}
