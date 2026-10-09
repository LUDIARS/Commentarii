// The designer's intent (design 7.4) as a consideration - only in an intent-assisted test
// (Astra review P1-4, spec/feature/engine.md §4.1). The intent is the answer key the verifier
// judges against; handing it to the decider would make the bot play the designer's solution and
// call that a human ability. Off (the default), it says nothing. On: a tactic the stage wants to
// teach and nodes on an intended route score 1; heading into a forbidden area scores 0, except
// in coverage runs, whose job is to try what the designer did not want.

import type { Consideration } from './utility-context.ts';

export const intentConsideration: Consideration = (candidate, { stage, purpose, intentAssist }) => {
  if (!intentAssist) return undefined;
  const items = stage?.intents ?? [];
  const { tactic, targetNode } = candidate.traits;
  if (tactic !== undefined && items.some((item) => item.kind === 'teach' && item.tactic === tactic)) return 1;
  if (targetNode === undefined) return undefined;
  if (items.some((item) => item.kind === 'forbid' && item.area === targetNode)) return purpose === 'coverage' ? undefined : 0;
  if (items.some((item) => item.kind === 'route' && item.path.includes(targetNode))) return 1;
  return undefined;
};
