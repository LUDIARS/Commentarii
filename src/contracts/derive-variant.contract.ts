// C-34 deriveVariant(origin, mutation): a variant is <origin>--<mutation>, learned, not
// superseded, unmeasured, keeps the origin's knowledge, because and expect, and brings in no
// reference the origin did not have (every string of its do / when is one of the origin's).

import { isDeepStrictEqual } from 'node:util';
import type { Tactic } from '../domain/documents.ts';
import type { TacticMutation, TacticVariant } from '../engine/candidates/tactic-variants.ts';

function strings(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') found.add(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, found);
  else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      found.add(key);
      strings(item, found);
    }
  }
  return found;
}

export default {
  post: (variant: TacticVariant | undefined, origin: Tactic, mutation: TacticMutation) => {
    if (variant === undefined) return true;
    const { tactic } = variant;
    if (tactic.id !== `${origin.id}--${mutation}` || variant.of !== origin.id || variant.mutation !== mutation) return 'variant identity does not follow <origin>--<mutation>';
    if (tactic.confidence !== 'learned' || tactic.superseded_by !== null || tactic.metrics !== undefined) return 'a variant must be learned, unmeasured and not superseded';
    if (tactic.knowledge !== origin.knowledge) return 'the variant changed the knowledge boundary';
    if (!isDeepStrictEqual(tactic.because, origin.because) || !isDeepStrictEqual(tactic.expect, origin.expect)) return 'the variant changed because or expect';
    const known = strings([origin.do, origin.when]);
    for (const text of strings([tactic.do, tactic.when])) if (!known.has(text)) return `the variant brings in ${text}`;
    return true;
  },
};
