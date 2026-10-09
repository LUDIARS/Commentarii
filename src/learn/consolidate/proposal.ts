// An update guide learn consolidate proposes to the canonical bundle (design 8.2, 8.4): one or
// more files, each with a JSON Patch (RFC 6902) over that file's document (a new file is one
// `add` at the root). `auto` proposals may be applied by --apply; `pending` ones wait for a
// person (approval), with the reason.

import type { TacticMetrics } from '../../domain/documents.ts';
import type { JsonPatchOperation } from '../patch/json-patch.ts';

export type ProposalKind = 'rewrite' | 'promotion' | 'entity-draft';
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

export interface Proposal {
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
}
