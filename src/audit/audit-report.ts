// Result of `guide audit mask`: what was found where, and why. The report never carries a
// masked value itself, only where it showed up and which guide value it matched (design §1).

export type FindingKind = 'value-hit' | 'key-hit' | 'undefined-exposure';

export interface Finding {
  readonly kind: FindingKind;
  /** Scanned file path as reported (POSIX separators). */
  readonly file: string;
  /** 1-based line and column of the match. */
  readonly line: number;
  readonly column: number;
  /**
   * What the match stands for: the masked value ref (`enemy:g:x.stats.body_mass`) for value-hit,
   * `forbidden_keys:<key>` for key-hit, `literal:<number>` for undefined-exposure.
   */
  readonly ref: string;
  /** Why this is a finding (the detection rule that fired), in plain words. */
  readonly reason: string;
}

export interface AllowDecision {
  readonly pattern: string;
  readonly rationale: string;
  readonly decided_by: string;
}

export interface AllowedFinding extends Finding {
  readonly allow: AllowDecision;
}

export interface AuditSummary {
  readonly game_id: string | undefined;
  readonly scanned_files: number;
  readonly hits: number;
  readonly warnings: number;
  readonly allowed: number;
  readonly by_kind: Readonly<Record<FindingKind, number>>;
}

export interface AuditReport {
  readonly summary: AuditSummary;
  /** value-hit and key-hit: masked values or forbidden keys reached the game's exposed surface. */
  readonly hits: readonly Finding[];
  /** undefined-exposure: numbers in UI text the guide does not know about. */
  readonly warnings: readonly Finding[];
  /** Findings excluded by `audit.allow[]`, with the stated rationale. */
  readonly allowed: readonly AllowedFinding[];
}
