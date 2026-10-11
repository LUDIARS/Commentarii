// Whether a divergence was already accepted by a person (intent allowed_divergences,
// spec/feature/intent-verify.md 4.2). An acceptance is bound to what was judged (Astra review
// P2-8): the same intended item, the same signature (tactic sequence and normalized route, or
// the divergence ID derived from them) and the guide version it was judged under.
//   match  intent and signature (or ID) agree and the version is the same (or was not recorded):
//          not reported again
//   stale  the entry names the divergence loosely (a run or a tactic only, no signature or
//          intent), or it was accepted under another guide version: reported again, marked for
//          re-evaluation, never silently suppressed
//   none   unrelated

import type { AllowedDivergence } from '../../domain/documents.ts';
import { sameSignature, type Divergence } from './divergence.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:590895dd */
import augurContract_08abbe53 from '../../contracts/match-allowed.contract.ts'; /* augur-inject:contract-predicate:516ad275 */

export type AllowedState = 'match' | 'stale' | 'none';

export interface AllowedMatch {
  readonly state: AllowedState;
  readonly allowed?: AllowedDivergence;
  /** Why a stale entry needs re-evaluation. */
  readonly why?: string;
}

function exact(allowed: AllowedDivergence, divergence: Divergence): boolean {
  // The divergence ID is derived from intent, reason and signature, so it binds all three.
  if (allowed.divergence !== undefined && allowed.divergence === divergence.id) return true;
  return allowed.intent === divergence.intent && allowed.signature !== undefined && sameSignature(allowed.signature, divergence.signature);
}

function loose(allowed: AllowedDivergence, divergence: Divergence): boolean {
  if (allowed.intent !== undefined && allowed.intent !== divergence.intent) return false;
  return divergence.runs.includes(allowed.run) || (allowed.tactic !== undefined && divergence.signature.tactics.includes(allowed.tactic));
}

export function matchAllowed(allowed: AllowedDivergence, divergence: Divergence, manifestVersion: string | undefined): AllowedMatch {
  if (exact(allowed, divergence)) {
    if (allowed.manifest_version !== undefined && manifestVersion !== undefined && allowed.manifest_version !== manifestVersion) {
      return { state: 'stale', allowed, why: `accepted under guide version ${allowed.manifest_version}, the guide is ${manifestVersion}` };
    }
    return { state: 'match', allowed };
  }
  if (loose(allowed, divergence)) return { state: 'stale', allowed, why: 'the acceptance names only a run or a tactic, not this intent and signature' };
  return { state: 'none' };
}
// @ts-expect-error augur-inject
matchAllowed = contract(matchAllowed, { ...augurContract_08abbe53, contractId: 'C-69', mode: 'observe', sample: 1, where: 'src/verify/intent/allowed-match.ts:35', rule: 'contract-wrap', id: '08abbe53' }); /* augur-inject:contract-wrap:08abbe53 */

/** The best acceptance of the divergence: an exact match wins over a stale one. */
export function findAllowed(allowed: readonly AllowedDivergence[], divergence: Divergence, manifestVersion?: string): AllowedMatch {
  const matches = allowed.map((entry) => matchAllowed(entry, divergence, manifestVersion));
  return matches.find((entry) => entry.state === 'match') ?? matches.find((entry) => entry.state === 'stale') ?? { state: 'none' };
}

/** True when the acceptance suppresses the divergence (kept for callers that only need yes / no). */
export function matchesAllowed(allowed: AllowedDivergence, divergence: Divergence, manifestVersion?: string): boolean {
  return matchAllowed(allowed, divergence, manifestVersion).state === 'match';
}
