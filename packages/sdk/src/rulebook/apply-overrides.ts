// Omniscient only: each masked companion replaces the keys it names of the visible action
// wholesale (no merge, design: Fable §3.2). The identity of the action (id, actor, params,
// maps_to) is never overridable, so player and omniscient agree on what can be done and differ
// only in what it does.

import type { Located } from '../bundle/bundle.ts';
import type { ActionDefinition, MaskedActionOverride } from '../domain/rulebook-documents.ts';
import type { OmniscientAction } from './rulebook-view.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:8b05f203 */
import augurContract_dc2b95b1 from '../contracts/apply-action-overrides.contract.ts'; /* augur-inject:contract-predicate:7ed8c42a */

export function applyActionOverrides(
  actions: readonly ActionDefinition[],
  overrides: readonly Located<MaskedActionOverride>[],
): OmniscientAction[] {
  const byId = new Map(overrides.map((located) => [located.doc.id, located]));
  return actions.map((action): OmniscientAction => {
    const located = byId.get(action.id);
    if (located === undefined) return action;
    const keys = Object.keys(located.doc.override).sort();
    return { ...action, ...located.doc.override, overridden: { keys, source: located.doc.source, path: located.path } };
  });
}
// @ts-expect-error augur-inject
applyActionOverrides = contract(applyActionOverrides, { ...augurContract_dc2b95b1, contractId: 'C-103', mode: 'observe', sample: 1, where: 'packages/sdk/src/rulebook/apply-overrides.ts:10', rule: 'contract-wrap', id: 'dc2b95b1' }); /* augur-inject:contract-wrap:dc2b95b1 */
