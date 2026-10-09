// Whether a divergence was already accepted by a person (intent allowed_divergences,
// spec/feature/intent-verify.md 4.2): by divergence ID, by signature, by run, or by tactic.
// Accepted divergences are not reported again.

import type { AllowedDivergence } from '../../domain/documents.ts';
import { sameSignature, type Divergence } from './divergence.ts';

function sameIntent(allowed: AllowedDivergence, divergence: Divergence): boolean {
  return allowed.intent === undefined || allowed.intent === divergence.intent;
}

export function matchesAllowed(allowed: AllowedDivergence, divergence: Divergence): boolean {
  if (allowed.divergence !== undefined && allowed.divergence === divergence.id) return true;
  if (allowed.signature !== undefined && sameIntent(allowed, divergence) && sameSignature(allowed.signature, divergence.signature)) return true;
  if (sameIntent(allowed, divergence) && divergence.runs.includes(allowed.run)) return true;
  return allowed.tactic !== undefined && allowed.intent === divergence.intent && divergence.signature.tactics.includes(allowed.tactic);
}

export function findAllowed(allowed: readonly AllowedDivergence[], divergence: Divergence): AllowedDivergence | undefined {
  return allowed.find((entry) => matchesAllowed(entry, divergence));
}
