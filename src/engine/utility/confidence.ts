// Confidence: how much the guide vouches for the candidate. Authored tactics most, then
// derived and learned; a generic action is a guess and an exploration move a gamble.

import type { TacticConfidence } from '../persona/persona.ts';
import type { Consideration } from './utility-context.ts';

const TACTIC_SCORE: Readonly<Record<TacticConfidence, number>> = { authored: 1, derived: 0.75, learned: 0.5 };
export const GENERIC_CONFIDENCE = 0.4;
export const EXPLORE_CONFIDENCE = 0.2;

export const confidenceConsideration: Consideration = (candidate) => {
  if (candidate.traits.confidence !== undefined) return TACTIC_SCORE[candidate.traits.confidence];
  return candidate.kind === 'generic' ? GENERIC_CONFIDENCE : EXPLORE_CONFIDENCE;
};
