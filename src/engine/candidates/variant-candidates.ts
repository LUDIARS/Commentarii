// Variant candidates (design 7.4 "定石の変種"): for every tactic the engine may use, the
// persona trusts and that is not held back (its last run is still being judged, or broke
// recently: its variants wait with it), each of its variants (tactic-variants.ts: reorder /
// relax / substitute) whose own `when` holds now and that is not held back itself. A relaxed
// variant can hold where its tactic does not, which is the point of relaxing. Variants are
// exploration candidates: they carry no confidence or metrics of their own (exploration scores
// them on novelty), and `traits.tactic` names the tactic they come from (so the knowledge
// boundary of that tactic is what the C-18 contract checks).

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { matchCondition } from '../match/match-condition.ts';
import { isTrusted, type Persona } from '../persona/persona.ts';
import type { EngineWorld } from '../world/engine-world.ts';
import type { Candidate } from './candidate.ts';
import { isHeldBack, type RunMemory } from './run-memory.ts';
import { tacticCandidate } from './tactic-candidates.ts';
import { deriveVariants, type TacticVariant } from './tactic-variants.ts';

/** Novelty of a variant that was tried before in this run (an untried one scores 1). */
export const TRIED_VARIANT_NOVELTY = 0.3;

export function variantCandidateId(variant: TacticVariant): string {
  return `variant:${variant.tactic.id}`;
}

function variantCandidate(variant: TacticVariant, observation: ObservationFrame, memory: RunMemory): Candidate | undefined {
  const id = variantCandidateId(variant);
  if (isHeldBack(memory, id, observation.t)) return undefined;
  const match = matchCondition(variant.tactic.when, observation);
  if (!match.ok) return undefined;
  const base = tacticCandidate(variant.tactic, match.bindings, observation, memory);
  const { confidence: _confidence, metrics: _metrics, ...traits } = base.traits;
  return {
    ...base,
    id,
    kind: 'explore',
    traits: { ...traits, tactic: variant.of, novelty: memory.tried.has(id) ? TRIED_VARIANT_NOVELTY : 1 },
    variant: { tactic: variant.tactic.id, of: variant.of, mutation: variant.mutation },
  };
}

export function variantCandidates(world: EngineWorld, persona: Persona, observation: ObservationFrame, memory: RunMemory): Candidate[] {
  const candidates: Candidate[] = [];
  for (const tactic of world.tactics) {
    if (!isTrusted(tactic.confidence, persona.min_confidence)) continue;
    if (isHeldBack(memory, tactic.id, observation.t)) continue;
    for (const variant of deriveVariants(tactic)) {
      const candidate = variantCandidate(variant, observation, memory);
      if (candidate !== undefined) candidates.push(candidate);
    }
  }
  return candidates;
}
