// Utility of one candidate: the weighted mean of the considerations that have something to say
// about it (persona weights; a consideration returning undefined is left out of both sums),
// plus the persona's hysteresis when it is the plan already running.

import type { Candidate } from '../candidates/candidate.ts';
import { CONSIDERATION_NAMES, type ConsiderationName, type Persona } from '../persona/persona.ts';
import { CONSIDERATIONS } from './considerations.ts';
import { clamp01, type UtilityContext } from './utility-context.ts';

export interface ScoredCandidate {
  readonly candidate: Candidate;
  readonly utility: number;
  readonly parts: Readonly<Partial<Record<ConsiderationName, number>>>;
}

/** Utilities are logged; 6 decimals keep the log short and are identical on every replay. */
function roundUtility(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function scoreCandidate(candidate: Candidate, persona: Persona, context: UtilityContext): ScoredCandidate {
  const parts: Partial<Record<ConsiderationName, number>> = {};
  let weighted = 0;
  let totalWeight = 0;
  for (const name of CONSIDERATION_NAMES) {
    const weight = persona.weights[name];
    if (weight <= 0) continue;
    const value = CONSIDERATIONS[name](candidate, context);
    if (value === undefined || !Number.isFinite(value)) continue;
    const score = clamp01(value);
    parts[name] = score;
    weighted += weight * score;
    totalWeight += weight;
  }
  const base = totalWeight > 0 ? weighted / totalWeight : 0;
  const bonus = candidate.continuing === true ? persona.hysteresis : 0;
  return { candidate, utility: roundUtility(base + bonus), parts };
}
