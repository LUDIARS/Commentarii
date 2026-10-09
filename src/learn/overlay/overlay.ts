// observations/overlay.json (design 8.1, schema/overlay.schema.json): what guide learn ingest
// concluded from player runs. The canonical bundle is never touched by it.

import type { Source, Tactic, TacticMetrics } from '../../domain/documents.ts';
import type { RenderSignature } from '../../engine/reflect/unknown-entities.ts';
import type { ConsiderationName } from '../../engine/persona/persona.ts';
import type { TacticMutation } from '../../engine/candidates/tactic-variants.ts';

/** Bundle-relative path of the overlay. */
export const OVERLAY_PATH = 'observations/overlay.json';

export interface OverlayVariant {
  readonly of: string;
  readonly mutation: TacticMutation;
}

export interface TacticSample {
  readonly run: string;
  readonly outcome: 'success' | 'failure';
  readonly time_sec: number;
  readonly damage_taken: number;
  readonly resource: Readonly<Record<string, number>>;
}

export interface OverlayTactic {
  readonly tactic: string;
  readonly variant?: OverlayVariant;
  /** In ingest order (run by run, line by line). */
  readonly samples: readonly TacticSample[];
  readonly metrics: TacticMetrics;
  readonly nodes: readonly string[];
}

export interface ValueEstimate {
  readonly run: string;
  readonly value: number;
  readonly hits?: number;
}

export interface OverlayValue {
  readonly entity: string;
  readonly quantity: string;
  readonly estimates: readonly ValueEstimate[];
}

export interface EntityDraft {
  readonly path: string;
  readonly draft: true;
  readonly source: Source;
  readonly doc: Readonly<Record<string, unknown>>;
}

export interface OverlayUnknown {
  readonly key: string;
  readonly entity?: string;
  readonly signature?: RenderSignature;
  readonly runs: readonly string[];
  readonly sightings: number;
  readonly draft: EntityDraft;
}

export interface OverlayMismatch {
  readonly tactic: string;
  readonly count: number;
  readonly runs: readonly string[];
}

export interface OverlayRewrite {
  /** The variant as a tactic document (learned, measured), ready to become canonical. */
  readonly tactic: Tactic;
  readonly of: string;
  readonly mutation: TacticMutation;
  readonly gain: number;
  readonly runs: number;
  readonly evidence: readonly string[];
}

export interface Overlay {
  readonly game_id: string;
  readonly runs: { readonly player: readonly string[]; readonly ignored_omniscient: readonly string[] };
  readonly tactics: readonly OverlayTactic[];
  readonly values: readonly OverlayValue[];
  readonly unknown_entities: readonly OverlayUnknown[];
  readonly mismatches: readonly OverlayMismatch[];
  readonly rewrites: readonly OverlayRewrite[];
  readonly weights: Readonly<Partial<Record<ConsiderationName, number>>>;
}

export function emptyOverlay(gameId: string): Overlay {
  return {
    game_id: gameId,
    runs: { player: [], ignored_omniscient: [] },
    tactics: [],
    values: [],
    unknown_entities: [],
    mismatches: [],
    rewrites: [],
    weights: {},
  };
}
