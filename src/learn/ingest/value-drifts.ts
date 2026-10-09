// "値のずれ" (design 6 learn ingest): for every (entity, quantity) the overlay has estimates of,
// the canonical value next to the estimates (count, mean, agreement). A value drifts when some
// run's estimate disagrees with it; a value the bundle does not have is listed as such.

import type { Bundle } from '../../bundle/bundle.ts';
import type { Knowledge } from '../../domain/knowledge.ts';
import type { Overlay } from '../overlay/overlay.ts';
import { resolveQuantity } from '../values/resolve-quantity.ts';
import { summarizeAgreement } from '../values/value-agreement.ts';

export interface ValueDrift {
  readonly entity: string;
  readonly quantity: string;
  /** <entity>.stats.<key>, when the bundle has the value. */
  readonly ref?: string;
  readonly canonical?: number;
  readonly knowledge?: Knowledge;
  readonly runs: number;
  readonly estimates: number;
  readonly mean: number;
  readonly agreement?: number;
  /** Some run disagrees with the canonical value (false when there is none to compare with). */
  readonly drifted: boolean;
}

export function findValueDrifts(bundle: Bundle, overlay: Overlay): ValueDrift[] {
  return overlay.values.map(({ entity, quantity, estimates }) => {
    const canonical = resolveQuantity(bundle, entity, quantity);
    const summary = summarizeAgreement(estimates, canonical?.value.value);
    return {
      entity,
      quantity,
      ...(canonical === undefined ? {} : { ref: canonical.ref, canonical: canonical.value.value, knowledge: canonical.value.knowledge }),
      runs: summary.runs,
      estimates: summary.estimates,
      mean: summary.mean,
      ...(summary.agreement === undefined ? {} : { agreement: summary.agreement }),
      drifted: summary.agreement !== undefined && summary.agreement < 1,
    };
  });
}
