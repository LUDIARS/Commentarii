// guide verify intent --accept <id> --by <name> (spec/feature/intent-verify.md 1.2): a person
// marks a divergence as allowed. The store entry gets decision allow, and the stage intent gets
// one allowed_divergences entry carrying the signature (so the divergence is not reported again).
// The only canonical change is that entry; tactics are never written (promotion to authored is
// reported, a person does it).

import type { AllowedDivergence, Intent, Tactic } from '../../domain/documents.ts';
import { VerifyError } from '../verify-error.ts';
import type { DivergenceStore, StoredDivergence } from './divergence-store.ts';
import { promotionCandidates, type PromotionCandidate } from './promotion-candidates.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:20ae773b */
import augurContract_d07a776c from '../../contracts/accept-divergence.contract.ts'; /* augur-inject:contract-predicate:cdc1110b */

export interface AcceptInput {
  readonly store: DivergenceStore;
  /** Intents of the bundle (the one of the divergence's stage is changed). */
  readonly intents: readonly Intent[];
  readonly tactics: readonly Tactic[];
  readonly id: string;
  readonly by: string;
  readonly note?: string;
}

export interface AcceptResult {
  readonly store: DivergenceStore;
  readonly entry: StoredDivergence;
  /** The stage's intent before the change. */
  readonly before: Intent;
  /** The stage's intent after the change (the same object when it already allowed the divergence). */
  readonly intent: Intent;
  readonly changed: boolean;
  readonly promotions: readonly PromotionCandidate[];
}

function allowedEntry(entry: StoredDivergence, by: string): AllowedDivergence {
  const [run] = entry.runs;
  if (run === undefined) throw new VerifyError(`divergence ${entry.id} has no run`);
  const [tactic] = entry.signature.tactics;
  return {
    run,
    summary: entry.summary,
    decided_by: by,
    ...(tactic === undefined ? {} : { tactic }),
    intent: entry.intent,
    reason: entry.reason,
    divergence: entry.id,
    signature: { tactics: [...entry.signature.tactics], route: [...entry.signature.route] },
  };
}

export function acceptDivergence(input: AcceptInput): AcceptResult {
  const found = input.store.divergences.find((entry) => entry.id === input.id);
  if (found === undefined) throw new VerifyError(`divergence ${input.id} is not in observations/divergences.json (run guide verify intent first)`);
  const before = input.intents.find((intent) => intent.stage === found.stage);
  if (before === undefined) throw new VerifyError(`no valid intent for ${found.stage}`);
  const entry: StoredDivergence = { ...found, decision: 'allow', decided_by: input.by, ...(input.note === undefined ? {} : { note: input.note }) };
  const store: DivergenceStore = { ...input.store, divergences: input.store.divergences.map((stored) => (stored.id === input.id ? entry : stored)) };
  const already = before.allowed_divergences.some((allowed) => allowed.divergence === input.id);
  const intent = already ? before : { ...before, allowed_divergences: [...before.allowed_divergences, allowedEntry(entry, input.by)] };
  return { store, entry, before, intent, changed: !already, promotions: promotionCandidates(entry.id, entry.signature, input.tactics) };
}
// @ts-expect-error augur-inject
acceptDivergence = contract(acceptDivergence, { ...augurContract_d07a776c, contractId: 'C-52', mode: 'observe', sample: 1, where: 'src/verify/intent/accept-divergence.ts:49', rule: 'contract-wrap', id: 'd07a776c' }); /* augur-inject:contract-wrap:d07a776c */
