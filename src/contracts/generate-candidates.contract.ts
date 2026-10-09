// C-18 generateCandidates(input): candidate IDs are unique and in ID order; in player mode no
// candidate comes from a masked, draft or superseded tactic (variants included); no tactic
// below the persona's confidence floor is proposed.

import type { Candidate } from '../engine/candidates/candidate.ts';
import type { GenerationInput } from '../engine/candidates/generate-candidates.ts';
import { isTrusted } from '../engine/persona/persona.ts';

export default {
  post: (candidates: readonly Candidate[], input: GenerationInput) => {
    const ids = candidates.map((candidate) => candidate.id);
    if (new Set(ids).size !== ids.length) return 'candidate IDs repeat';
    if (ids.some((id, index) => index > 0 && (ids[index - 1] ?? '') > id)) return 'candidates are not in ID order';
    if (input.world.mode === 'player') {
      if (input.world.tactics.some((tactic) => tactic.knowledge === 'masked')) return 'player world holds a masked tactic';
    }
    const usable = new Map(input.world.tactics.map((tactic) => [tactic.id, tactic]));
    for (const candidate of candidates) {
      const source = candidate.traits.tactic;
      if (source === undefined || candidate.continuing === true) continue;
      const tactic = usable.get(source);
      if (tactic === undefined) return `${candidate.id} comes from ${source}, which the engine may not use`;
      if (tactic.draft === true || tactic.superseded_by !== null) return `${candidate.id} comes from a draft or superseded tactic`;
      if (input.world.mode === 'player' && tactic.knowledge === 'masked') return `${candidate.id} comes from a masked tactic in player mode`;
      if (!isTrusted(tactic.confidence, input.persona.min_confidence)) return `${candidate.id} is below the persona's confidence floor`;
    }
    return true;
  },
};
