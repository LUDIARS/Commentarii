// C-41 extractCandidates(input): every candidate is a learned draft tactic (confidence learned,
// draft true, knowledge masked, not superseded) with source.kind human and evidence from the
// given runs; candidate IDs are unique, in ID order and never an existing tactic's ID; no
// candidate repeats an existing tactic's when + do.

import type { CandidateExtraction } from '../import/plays/extract-candidates.ts';
import type { HumanCandidates } from '../import/plays/human-candidates.ts';

export default {
  post: (result: HumanCandidates, input: CandidateExtraction) => {
    const ids = result.candidates.map((candidate) => candidate.tactic.id);
    if (new Set(ids).size !== ids.length) return 'candidate IDs repeat';
    if (ids.some((id, index) => index > 0 && (ids[index - 1] ?? '') > id)) return 'candidates are not in ID order';
    const existingIds = new Set(input.tactics.map((tactic) => tactic.id));
    const existingShapes = new Set(input.tactics.map((tactic) => JSON.stringify([tactic.when, tactic.do])));
    const runIds = new Set(input.runs.map((run) => run.header.run_id));
    for (const { tactic, source, evidence } of result.candidates) {
      if (tactic.confidence !== 'learned' || tactic.draft !== true || tactic.knowledge !== 'masked' || tactic.superseded_by !== null) {
        return `${tactic.id} is not a masked learned draft`;
      }
      if (source.kind !== 'human') return `${tactic.id} does not come from humans`;
      if (existingIds.has(tactic.id)) return `${tactic.id} reuses an existing tactic ID`;
      if (existingShapes.has(JSON.stringify([tactic.when, tactic.do]))) return `${tactic.id} repeats an existing tactic`;
      if (evidence.runs !== evidence.run_ids.length || evidence.occurrences < evidence.runs) return `${tactic.id} has inconsistent evidence counts`;
      if (evidence.run_ids.some((id) => !runIds.has(id))) return `${tactic.id} cites a run that was not given`;
    }
    return result.runs === input.runs.length ? true : 'the run count differs from the input';
  },
};
