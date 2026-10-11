// C-103 applyActionOverrides(actions, overrides): one action out per action in, same order and
// identity (id, actor, params, maps_to); an overridden action carries exactly the override's
// keys, replaced wholesale.

import type { Located } from '../bundle/bundle.ts';
import type { ActionDefinition, MaskedActionOverride } from '../domain/rulebook-documents.ts';
import type { OmniscientAction } from '../rulebook/rulebook-view.ts';

const IDENTITY = ['id', 'actor', 'params', 'maps_to'] as const;

export default {
  post: (result: readonly OmniscientAction[], actions: readonly ActionDefinition[], overrides: readonly Located<MaskedActionOverride>[]) => {
    if (result.length !== actions.length) return 'action count changed';
    for (const [i, action] of actions.entries()) {
      const out = result[i];
      if (out === undefined) return 'action missing';
      for (const key of IDENTITY) if (JSON.stringify(out[key]) !== JSON.stringify(action[key])) return `${action.id}: ${key} changed`;
      const override = overrides.find((located) => located.doc.id === action.id)?.doc.override;
      if (override === undefined) {
        if (out.overridden !== undefined) return `${action.id} marked overridden without an override`;
        continue;
      }
      for (const [key, value] of Object.entries(override)) {
        if (JSON.stringify((out as unknown as Record<string, unknown>)[key]) !== JSON.stringify(value)) return `${action.id}: ${key} is not the override's`;
      }
      if (out.overridden?.keys.join(',') !== Object.keys(override).sort().join(',')) return `${action.id}: overridden keys differ`;
    }
    return true;
  },
};
