// An update guide learn consolidate proposes to the canonical bundle (design 8.2, 8.4): one or
// more files, each with a JSON Patch (RFC 6902) over that file's document (a new file is one
// `add` at the root). `auto` proposals may be applied by --apply; `pending` ones wait for a
// person (approval), with the reason.

import type { TacticMetrics } from '../../domain/documents.ts';
import type { JsonPatchOperation } from '../patch/json-patch.ts';

export type ProposalKind = 'rewrite' | 'promotion' | 'entity-draft' | 'human-tactic';
export type ProposalStatus = 'auto' | 'pending';

export interface FilePatch {
  /** Bundle-relative path. */
  readonly path: string;
  /** The file does not exist yet. */
  readonly create: boolean;
  readonly patch: readonly JsonPatchOperation[];
}

export interface RewriteDetail {
  readonly of: string;
  readonly mutation: string;
  readonly before: { readonly when: unknown; readonly do: unknown };
  readonly after: { readonly when: unknown; readonly do: unknown };
  readonly origin_metrics?: TacticMetrics;
  readonly variant_metrics: TacticMetrics;
  readonly gain: number;
}

export interface PromotionDetail {
  readonly ref: string;
  readonly value: number;
  readonly player_runs: number;
  readonly agreement: number;
  readonly requires: { readonly player_runs: number; readonly agreement: number };
}

export interface HumanTacticDetail {
  readonly stage: string;
  readonly occurrences: number;
  readonly runs: number;
  readonly players: number;
  readonly success_rate?: number;
}

/**
 * What a proposal was measured and judged against (spec/feature/learning.md §4.2): the game and
 * guide version, the condition it compares under and the units of its metrics. Part of the
 * content hash, so an approval does not carry over to another version or condition.
 */
export interface ProposalBasis {
  readonly game_id: string;
  readonly manifest_version: string;
  readonly builds: readonly string[];
  /** The `when` both sides of a comparison were measured under (rewrite / human-tactic). */
  readonly condition?: unknown;
  readonly units: Readonly<Record<string, string>>;
}

/** A proposal as the generators make it, before consolidate seals it with its basis and hash. */
export interface ProposalDraft {
  /** Stable within one consolidate: <kind>:<subject>. */
  readonly id: string;
  readonly kind: ProposalKind;
  readonly status: ProposalStatus;
  /** Why it is auto or why it waits. */
  readonly reason: string;
  readonly files: readonly FilePatch[];
  /** Player runs it rests on. */
  readonly evidence: readonly string[];
  readonly rewrite?: RewriteDetail;
  readonly promotion?: PromotionDetail;
  readonly human?: HumanTacticDetail;
  /** The condition the proposal compares under (folded into the basis). */
  readonly condition?: unknown;
}

export interface Proposal extends Omit<ProposalDraft, 'condition'> {
  readonly basis: ProposalBasis;
  /** sha256 over everything an approver judges (approval/proposal-hash.ts). */
  readonly content_hash: string;
}
