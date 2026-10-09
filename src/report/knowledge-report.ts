// Shape of the knowledge boundary report (design 5: report knowledge).
// The report carries counts, IDs and file locations only — never a masked value.

export interface KnowledgeRatio {
  readonly shown: number;
  readonly discoverable: number;
  readonly masked: number;
}

export interface KnowledgeCounts {
  readonly shown: number;
  readonly discoverable: number;
  readonly masked: number;
  readonly total: number;
  readonly ratio: KnowledgeRatio;
}

export interface EntityKnowledgeRow extends KnowledgeCounts {
  readonly id: string;
}

export type UngroundedReason = 'missing-source' | 'llm-draft-source';

/** A shown / discoverable value whose boundary has no ground (principle 3). */
export interface UngroundedValue {
  readonly path: string;
  readonly pointer: string;
  readonly knowledge: 'shown' | 'discoverable';
  readonly reason: UngroundedReason;
}

export interface TacticReferencingMasked {
  readonly tactic: string;
  /** How many references resolve to masked values; the references themselves stay hidden. */
  readonly masked_refs: number;
}

export interface KnowledgeReport {
  readonly game_id: string | null;
  readonly entities: readonly EntityKnowledgeRow[];
  readonly totals: KnowledgeCounts;
  readonly ungrounded: readonly UngroundedValue[];
  readonly tactics_referencing_masked: readonly TacticReferencingMasked[];
}
