// C-50 classifyIntents(input): no omniscient run appears in a trace, verdict or divergence; no
// reported divergence matches an allowed_divergences entry; impossible only with a proof (an
// unwalkable route or a taught tactic missing from the guide), and an unreproduced route / teach
// without one is not-reproduced; an item with an open undesirable divergence is
// undesirable (unless impossible), and one with open divergences is never match.

import { matchesAllowed } from '../verify/intent/allowed-match.ts';
import type { ClassifyInput, IntentVerification } from '../verify/intent/classify-intents.ts';

export default {
  post: (result: IntentVerification, input: ClassifyInput) => {
    const omniscient = new Set(input.ignoredOmniscient);
    for (const trace of input.traces) if (omniscient.has(trace.run)) return `omniscient ${trace.run} was handed in as a trace`;
    for (const divergence of [...result.divergences, ...result.accepted.map((entry) => entry.divergence)]) {
      for (const run of divergence.runs) if (omniscient.has(run)) return `omniscient ${run} is used in divergence ${divergence.id}`;
    }
    for (const divergence of result.divergences) {
      if (input.intent.allowed_divergences.some((allowed) => matchesAllowed(allowed, divergence, input.manifestVersion))) return `allowed divergence ${divergence.id} is reported again`;
    }
    for (const verdict of result.verdicts) {
      const open = result.divergences.filter((divergence) => divergence.intent === verdict.intent);
      if (verdict.classification === 'impossible' && verdict.proof === undefined) return `${verdict.intent} is impossible without a proof`;
      if (verdict.proof === undefined && verdict.runs > 0 && verdict.reproduced === 0 && (verdict.kind === 'route' || verdict.kind === 'teach') && verdict.classification !== 'not-reproduced') {
        return `${verdict.intent} was reproduced by no run but is ${verdict.classification}`;
      }
      if (verdict.classification !== 'impossible' && verdict.classification !== 'not-reproduced' && open.some((divergence) => divergence.kind === 'undesirable') && verdict.classification !== 'undesirable') {
        return `${verdict.intent} has an open undesirable divergence but is ${verdict.classification}`;
      }
      if (verdict.classification === 'match' && open.length > 0) return `${verdict.intent} is match with open divergences`;
    }
    return true;
  },
};
