import type { Intent, IntendedItem } from './documents.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:801ca0d1 */
import augurContract_4e375a78 from '../contracts/without-intent-hints.contract.ts'; /* augur-inject:contract-predicate:90c6b293 */

type TeachItem = Extract<IntendedItem, { readonly kind: 'teach' }>;
type RouteItem = Extract<IntendedItem, { readonly kind: 'route' }>;

export type DecisionIntentItem = Exclude<IntendedItem, TeachItem | RouteItem> | Omit<TeachItem, 'hints' | 'level'> | Omit<RouteItem, 'level'>;

export interface PlayerIntent extends Omit<Intent, 'intended'> {
  readonly intended: readonly DecisionIntentItem[];
}

/** Keep authored intent usable by existing intent-assisted modes without evaluator hints. */
export function withoutIntentHints(item: IntendedItem): DecisionIntentItem {
  if (item.kind === 'route') {
    const { level: _level, ...visible } = item;
    return visible;
  }
  if (item.kind !== 'teach') return item;
  const { hints: _hints, level: _level, ...visible } = item;
  return visible;
}
// @ts-expect-error augur-inject
withoutIntentHints = contract(withoutIntentHints, { ...augurContract_4e375a78, contractId: 'C-108', mode: 'observe', sample: 1, where: 'packages/sdk/src/domain/intent-view.ts:12', rule: 'contract-wrap', id: '4e375a78' }); /* augur-inject:contract-wrap:4e375a78 */
