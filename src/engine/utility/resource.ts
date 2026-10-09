// Resources: a tactic whose measured resource cost self cannot pay scores 0 (1 when it can);
// gathering scores higher the less self holds.

import { resourceAmount, resourceAmounts } from '../observation/self-readings.ts';
import type { Consideration } from './utility-context.ts';

/** Held amount at which the urge to gather halves. */
export const GATHER_SCALE = 50;

export const resourceConsideration: Consideration = (candidate, { observation }) => {
  const cost = candidate.traits.metrics?.resource;
  if (cost !== undefined && Object.keys(cost).length > 0) {
    const affordable = Object.entries(cost).every(([name, amount]) => (resourceAmount(observation, name) ?? 0) >= amount);
    return affordable ? 1 : 0;
  }
  if (candidate.traits.gathers === true) {
    const amounts = resourceAmounts(observation);
    if (amounts.length === 0) return 1;
    const mean = amounts.reduce((total, [, amount]) => total + amount, 0) / amounts.length;
    return 1 / (1 + Math.max(mean, 0) / GATHER_SCALE);
  }
  return undefined;
};
