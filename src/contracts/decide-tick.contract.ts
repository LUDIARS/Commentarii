// C-19 decideTick(input): the decision log lists each candidate once with a finite utility; at
// most one is chosen and it is the outcome's chosen candidate; every candidate scored above it
// is listed as skipped; the action has exactly one verb, and idling (nothing chosen) waits.

import type { TickInput, TickOutcome } from '../engine/decide-tick.ts';
import { ACTION_VERBS } from '../replay/replay-action.ts';

export default {
  post: (outcome: TickOutcome, _input: TickInput) => {
    const ids = outcome.decision.map((entry) => entry.candidate);
    if (new Set(ids).size !== ids.length) return 'a candidate is logged twice';
    if (outcome.decision.some((entry) => !Number.isFinite(entry.utility))) return 'a utility is not finite';
    const chosen = outcome.decision.filter((entry) => entry.chosen);
    if (chosen.length > 1) return 'more than one candidate chosen';
    if ((chosen[0]?.candidate ?? undefined) !== outcome.chosen) return 'logged choice differs from the outcome';
    const verbs = ACTION_VERBS.filter((verb) => outcome.action[verb] !== undefined);
    if (verbs.length !== 1) return `action has ${verbs.length} verbs`;
    if (outcome.chosen === undefined) return outcome.action.wait === 0 || 'idle tick does not wait';
    const utility = chosen[0]?.utility ?? 0;
    const skipped = new Set(outcome.skipped);
    const passedOver = outcome.decision.filter((entry) => entry.utility > utility && !skipped.has(entry.candidate));
    return passedOver.length === 0 || `${passedOver[0]?.candidate} scored higher but was neither chosen nor skipped`;
  },
};
