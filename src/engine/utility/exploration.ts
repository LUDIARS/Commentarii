// Exploration bonus (design 7.4): on exploring ticks, how new the candidate is to the run
// (unvisited node, untried tactic or variant). On other ticks an exploration candidate scores
// 0 here (exploring is its only point) and everything else is not judged on it.

import type { Consideration } from './utility-context.ts';

export const explorationConsideration: Consideration = (candidate, { exploring }) => {
  if (exploring) return candidate.traits.novelty;
  return candidate.kind === 'explore' ? 0 : undefined;
};
