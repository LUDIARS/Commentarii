// Whether a guide tactic already covers what a human did in an episode: its `when` holds on the
// episode's first observation (the engine's own matcher) and its `do`, with the bindings that
// match produced, is the same step sequence (waits and repeats aside, as for episodes).

import type { Tactic } from '../../domain/documents.ts';
import { isBindingName, type Bindings } from '../../engine/match/bindings.ts';
import { matchCondition } from '../../engine/match/match-condition.ts';
import { MAX_STEPS, stepKey, type Episode, type TacticStep } from './segment-episodes.ts';

function rebind(step: TacticStep, bindings: Bindings, episode: Episode): TacticStep | undefined {
  const rebound: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(step)) {
    if (!isBindingName(value)) {
      rebound[key] = value;
      continue;
    }
    const instance = bindings[value];
    const name = instance === undefined ? undefined : episode.situation.bindings.get(instance);
    if (name === undefined) return undefined;
    rebound[key] = name;
  }
  return rebound;
}

function normalizedDo(tactic: Tactic, bindings: Bindings, episode: Episode): string[] | undefined {
  const steps: string[] = [];
  for (const step of tactic.do) {
    if (step.wait !== undefined) continue;
    const rebound = rebind(step, bindings, episode);
    if (rebound === undefined) return undefined;
    const text = stepKey(rebound);
    if (steps.at(-1) !== text) steps.push(text);
  }
  return steps.slice(0, MAX_STEPS);
}

export function coversEpisode(tactic: Tactic, episode: Episode): boolean {
  const matched = matchCondition(tactic.when, episode.observation);
  if (!matched.ok) return false;
  const steps = normalizedDo(tactic, matched.bindings, episode);
  if (steps === undefined || steps.length !== episode.steps.length) return false;
  return steps.every((step, index) => {
    const own = episode.steps[index];
    return own !== undefined && step === stepKey(own);
  });
}
