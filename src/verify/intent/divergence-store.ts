// observations/divergences.json (schema/divergences.schema.json): the divergence candidates and
// the human verdict on each (spec/feature/intent-verify.md 4.3). Merging a new verification
// keeps every entry and every human field, widens runs / personas of the ones seen again and
// adds the new ones as pending. Accepted divergences never come in (classify-intents.ts sets
// them apart). Past verdicts only order the list: pending, then allow, then reject.

import type { DivergenceReason, DivergenceSignature } from '../../domain/documents.ts';
import type { Divergence, DivergenceKind } from './divergence.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:d56b48d3 */
import augurContract_f33e3f27 from '../../contracts/merge-divergences.contract.ts'; /* augur-inject:contract-predicate:a6198387 */

export const DIVERGENCES_PATH = 'observations/divergences.json';

export type DivergenceDecision = 'allow' | 'reject' | 'pending';

export interface StoredDivergence {
  readonly id: string;
  readonly stage: string;
  readonly intent: string;
  readonly kind: DivergenceKind;
  readonly reason: DivergenceReason;
  readonly summary: string;
  readonly runs: readonly string[];
  readonly personas: readonly string[];
  readonly signature: DivergenceSignature;
  readonly decision: DivergenceDecision;
  readonly decided_by?: string;
  readonly note?: string;
}

export interface DivergenceStore {
  readonly game_id: string;
  readonly divergences: readonly StoredDivergence[];
}

const DECISION_ORDER: Readonly<Record<DivergenceDecision, number>> = { pending: 0, allow: 1, reject: 2 };
const KIND_ORDER: Readonly<Record<DivergenceKind, number>> = { undesirable: 0, interesting: 1 };

function union(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

export function orderDivergences<T extends { readonly id: string; readonly kind: DivergenceKind }>(entries: readonly T[], decisionOf: (entry: T) => DivergenceDecision): T[] {
  return [...entries].sort(
    (a, b) =>
      DECISION_ORDER[decisionOf(a)] - DECISION_ORDER[decisionOf(b)] ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function mergeDivergences(store: DivergenceStore | undefined, gameId: string, found: readonly Divergence[]): DivergenceStore {
  const merged = new Map<string, StoredDivergence>((store?.divergences ?? []).map((entry) => [entry.id, entry]));
  for (const found_ of found) {
    // recheck is a property of this verification (an acceptance that no longer binds), not of the stored divergence.
    const { recheck: _recheck, ...divergence } = found_;
    const existing = merged.get(divergence.id);
    merged.set(
      divergence.id,
      existing === undefined
        ? { ...divergence, runs: [...divergence.runs], personas: [...divergence.personas], decision: 'pending' }
        : { ...existing, runs: union(existing.runs, divergence.runs), personas: union(existing.personas, divergence.personas) },
    );
  }
  return { game_id: store?.game_id ?? gameId, divergences: orderDivergences([...merged.values()], (entry) => entry.decision) };
}
// @ts-expect-error augur-inject
mergeDivergences = contract(mergeDivergences, { ...augurContract_f33e3f27, contractId: 'C-51', mode: 'observe', sample: 1, where: 'src/verify/intent/divergence-store.ts:50', rule: 'contract-wrap', id: 'f33e3f27' }); /* augur-inject:contract-wrap:f33e3f27 */

/** The human verdict on a divergence, pending when it was never stored. */
export function decisionIn(store: DivergenceStore | undefined, id: string): DivergenceDecision {
  return store?.divergences.find((entry) => entry.id === id)?.decision ?? 'pending';
}
