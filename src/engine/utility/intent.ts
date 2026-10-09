// The designer's intent (design 7.4): a tactic the stage wants to teach and nodes on an
// intended route score 1; heading into a forbidden area scores 0, except in coverage runs,
// whose job is to try what the designer did not want (then the intent stays silent).

import type { Consideration } from './utility-context.ts';

export const intentConsideration: Consideration = (candidate, { stage, purpose }) => {
  const items = stage?.intents ?? [];
  const { tactic, targetNode } = candidate.traits;
  if (tactic !== undefined && items.some((item) => item.kind === 'teach' && item.tactic === tactic)) return 1;
  if (targetNode === undefined) return undefined;
  if (items.some((item) => item.kind === 'forbid' && item.area === targetNode)) return purpose === 'coverage' ? undefined : 0;
  if (items.some((item) => item.kind === 'route' && item.path.includes(targetNode))) return 1;
  return undefined;
};
