// C-69 matchAllowed(allowed, divergence, manifestVersion): an acceptance suppresses a divergence
// only when it names the divergence ID or the same intent and signature, and was not judged under
// another guide version; an entry naming only a run or a tactic never suppresses it.

import type { AllowedDivergence } from '../domain/documents.ts';
import type { AllowedMatch } from '../verify/intent/allowed-match.ts';
import { sameSignature, type Divergence } from '../verify/intent/divergence.ts';

export default {
  post: (result: AllowedMatch, allowed: AllowedDivergence, divergence: Divergence, manifestVersion: string | undefined) => {
    if (result.state !== 'match') return true;
    const byId = allowed.divergence === divergence.id;
    const bySignature = allowed.intent === divergence.intent && allowed.signature !== undefined && sameSignature(allowed.signature, divergence.signature);
    if (!byId && !bySignature) return 'suppressed without the divergence ID or intent + signature';
    if (allowed.manifest_version !== undefined && manifestVersion !== undefined && allowed.manifest_version !== manifestVersion) return 'suppressed by an acceptance of another guide version';
    return true;
  },
};
