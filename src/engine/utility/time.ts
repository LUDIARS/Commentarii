// Remaining time: as the stage clock runs out, candidates that push the stage forward rise from
// 0.5 to 1 and everything else (wandering, retreating, gathering) falls from 0.5 to 0. The limit
// is the stage's own time limit; the designer's intended upper bound stands in only in the
// intent-assisted test (Astra review P1-4). Silent when no limit is known.

import { stageElapsed } from '../match/match-stage.ts';
import { clamp01, type Consideration } from './utility-context.ts';

export const timeConsideration: Consideration = (candidate, { observation, stage, intentAssist }) => {
  const limit = stage?.timeLimit ?? (intentAssist ? stage?.intendedTimeLimit : undefined);
  if (limit === undefined) return undefined;
  const pressure = clamp01(stageElapsed(observation) / limit);
  return candidate.traits.progresses === true ? 0.5 + 0.5 * pressure : 0.5 - 0.5 * pressure;
};
