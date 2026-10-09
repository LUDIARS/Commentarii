// Distance: the nearer the thing a candidate acts on, the more pressing the candidate
// (an enemy in reach to fight, or a threat close enough to flee from).

import type { Consideration } from './utility-context.ts';

/** Distance at which the score halves (manifest units). */
export const DISTANCE_SCALE = 20;

export const distanceConsideration: Consideration = (candidate) => {
  const d = candidate.traits.targetDistance;
  return d === undefined ? undefined : 1 / (1 + Math.max(d, 0) / DISTANCE_SCALE);
};
