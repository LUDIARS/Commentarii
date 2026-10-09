// Human alternative candidates -> canonical tactic proposals (design 14.D, spec/feature/learning.md §4.3):
// observations/human/candidates.json holds action sequences human players used where no tactic
// of the guide applies. Each becomes a proposal to add tactics/<slug>.json (learned, no longer
// draft: the approver's review is what lifts the draft flag). Never automatic: a human solution
// is a design question (is it an intended route, a bait, a bug?), so it always waits for an
// approval bound to its content hash. Candidates whose tactic ID already exists are skipped.

import type { Bundle } from '../../bundle/bundle.ts';
import { parseRef } from '../../domain/id.ts';
import type { HumanCandidate, HumanCandidates } from '../../import/plays/human-candidates.ts';
import type { ProposalDraft } from './proposal.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:5535e152 */
import augurContract_a9f68eeb from '../../contracts/human-tactic-proposals.contract.ts'; /* augur-inject:contract-predicate:e19289a0 */

function proposalOf(candidate: HumanCandidate): ProposalDraft | undefined {
  const slug = parseRef(candidate.tactic.id)?.slug;
  if (slug === undefined) return undefined;
  const { draft: _draft, ...tactic } = candidate.tactic;
  const { evidence } = candidate;
  return {
    id: `human-tactic:${candidate.tactic.id}`,
    kind: 'human-tactic',
    status: 'pending',
    reason: 'a human alternative becomes canonical only by approval (design 14.D)',
    files: [{ path: `tactics/${slug}.json`, create: true, patch: [{ op: 'add', path: '', value: { ...tactic, confidence: 'learned', draft: false } }] }],
    evidence: evidence.run_ids,
    human: { stage: evidence.stage, occurrences: evidence.occurrences, runs: evidence.runs, players: evidence.players, success_rate: evidence.success_rate },
    condition: candidate.tactic.when,
  };
}

export function humanTacticProposals(bundle: Bundle, candidates: HumanCandidates | undefined): ProposalDraft[] {
  if (candidates === undefined) return [];
  const known = new Set(bundle.tactics.map(({ doc }) => doc.id));
  return candidates.candidates
    .filter((candidate) => !known.has(candidate.tactic.id))
    .map(proposalOf)
    .filter((proposal): proposal is ProposalDraft => proposal !== undefined);
}
// @ts-expect-error augur-inject
humanTacticProposals = contract(humanTacticProposals, { ...augurContract_a9f68eeb, contractId: 'C-67', mode: 'observe', sample: 1, where: 'src/learn/consolidate/human-tactic-proposals.ts:30', rule: 'contract-wrap', id: 'a9f68eeb' }); /* augur-inject:contract-wrap:a9f68eeb */
