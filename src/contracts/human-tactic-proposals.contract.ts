// C-67 humanTacticProposals(bundle, candidates): every proposal is pending, creates exactly one
// tactics/ file holding a non-draft learned tactic, rests on the candidate's run IDs, and no
// proposal is made for a tactic ID the bundle already has.

import type { Bundle } from '../bundle/bundle.ts';
import type { HumanCandidates } from '../import/plays/human-candidates.ts';
import type { ProposalDraft } from '../learn/consolidate/proposal.ts';

export default {
  post: (proposals: ProposalDraft[], bundle: Bundle, candidates: HumanCandidates | undefined) => {
    const known = new Set(bundle.tactics.map(({ doc }) => doc.id));
    for (const proposal of proposals) {
      if (proposal.status !== 'pending') return `${proposal.id} is not pending`;
      const [file, ...others] = proposal.files;
      if (file === undefined || others.length > 0 || !file.create || !file.path.startsWith('tactics/')) return `${proposal.id} does not create one tactic file`;
      const value = file.patch[0]?.op === 'add' ? (file.patch[0].value as { id?: string; draft?: unknown; confidence?: unknown }) : undefined;
      if (value?.draft !== false || value.confidence !== 'learned') return `${proposal.id} does not land a non-draft learned tactic`;
      if (value.id !== undefined && known.has(value.id)) return `${proposal.id} duplicates an existing tactic`;
      const candidate = candidates?.candidates.find((entry) => entry.tactic.id === value.id);
      if (candidate === undefined || proposal.evidence.join() !== candidate.evidence.run_ids.join()) return `${proposal.id} lost its evidence runs`;
    }
    return true;
  },
};
