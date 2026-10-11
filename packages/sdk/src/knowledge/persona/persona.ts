// A player persona (design 14.E, schema/persona.schema.json): how one kind of player weighs
// the Utility considerations and how they play (exploration, reaction delay, misplays, which
// tactics they trust).

import type { LocalizedText } from '../../domain/documents.ts';

export const CONSIDERATION_NAMES = ['distance', 'hp', 'time', 'resource', 'confidence', 'metrics', 'intent', 'exploration'] as const;
export type ConsiderationName = (typeof CONSIDERATION_NAMES)[number];

export type TacticConfidence = 'authored' | 'derived' | 'learned';

export interface Persona {
  readonly slug: string;
  readonly name: LocalizedText;
  readonly description?: LocalizedText;
  readonly weights: Readonly<Record<ConsiderationName, number>>;
  readonly exploration_rate: number;
  readonly reaction_delay_ticks: number;
  readonly misplay_rate: number;
  readonly min_confidence: TacticConfidence;
  readonly hysteresis: number;
  readonly links?: Readonly<Record<string, string>>;
}

/** Trust order: authored (a person wrote it) > derived (from rules) > learned (from runs). */
const TRUST: Readonly<Record<TacticConfidence, number>> = { learned: 0, derived: 1, authored: 2 };

/** Whether a persona whose floor is `floor` uses a tactic of `confidence`. */
export function isTrusted(confidence: TacticConfidence, floor: TacticConfidence): boolean {
  return TRUST[confidence] >= TRUST[floor];
}
