// observations/human/candidates.json (schema/human-candidates.schema.json): what human players
// did in a situation that no guide tactic covers, as learned draft tactics with their evidence.

import type { Tactic } from '../../domain/documents.ts';

export interface CandidateEvidence {
  readonly stage: string;
  /** Episodes with this situation and step sequence. */
  readonly occurrences: number;
  readonly runs: number;
  readonly players: number;
  readonly run_ids: readonly string[];
  /** Share of those runs that ended in success. */
  readonly success_rate: number;
}

export interface HumanCandidate {
  readonly tactic: Tactic;
  readonly source: { readonly kind: 'human'; readonly ref: string };
  readonly evidence: CandidateEvidence;
}

export interface HumanCandidates {
  readonly game_id: string;
  /** Human runs the candidates were extracted from. */
  readonly runs: number;
  readonly candidates: readonly HumanCandidate[];
}
