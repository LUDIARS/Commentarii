// One line of observations/runs/<run-id>.jsonl (design 4.4, schema/observation.schema.json):
// what reflect concluded on one tick, as opposed to the observation frame it saw. Lines carry
// IDs and numbers only (design 10: no proper names or paths in observation logs).

import type { ObservationFrame, ObservationMode, ObservationPurpose, ObservationSource } from '../../replay/observation-frame.ts';
import type { TacticMutation } from '../candidates/tactic-variants.ts';

export const OVERLAY_LINE_KINDS = ['mismatch', 'unknown-entity', 'tactic-outcome', 'value-estimate'] as const;
export type OverlayLineKind = (typeof OVERLAY_LINE_KINDS)[number];

/** start when a tactic begins; success / failure when its expect is met / broken; unresolved at run end. */
export const TACTIC_OUTCOMES = ['start', 'success', 'failure', 'unresolved'] as const;
export type TacticOutcome = (typeof TACTIC_OUTCOMES)[number];

export interface LineVariant {
  readonly of: string;
  readonly mutation: TacticMutation;
}

export interface OverlayLine {
  readonly t: number;
  readonly tick: number;
  readonly kind: OverlayLineKind;
  readonly tactic?: string;
  readonly entity?: string;
  readonly expected?: Readonly<Record<string, unknown>>;
  readonly observed?: Readonly<Record<string, unknown>>;
  readonly variant?: LineVariant;
  readonly source: ObservationSource;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
}

/** The fields every line takes from the frame it was concluded on. */
export function lineOf(frame: ObservationFrame, kind: OverlayLineKind): OverlayLine {
  return { t: frame.t, tick: frame.tick, kind, source: frame.source, mode: frame.mode, purpose: frame.purpose };
}
