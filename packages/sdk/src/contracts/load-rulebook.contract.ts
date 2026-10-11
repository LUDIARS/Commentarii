// C-102 loadRulebook(exported, mode): the player rulebook has no trace of the mask - no masked
// knowledge, no override and no overridden mark at any depth; the omniscient one is only built
// from a full export.

import type { RulebookSource } from '../rulebook/load-rulebook.ts';
import type { Rulebook, RulebookMode } from '../rulebook/rulebook-view.ts';

const TRACE_KEYS = new Set(['override', 'overridden', 'masked_actions']);

function trace(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = trace(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (TRACE_KEYS.has(key)) return `key '${key}'`;
    if (key === 'knowledge' && child === 'masked') return 'knowledge: masked';
    const found = trace(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

export default {
  post: (rulebook: Rulebook, exported: RulebookSource, mode: RulebookMode) => {
    if (rulebook.mode !== mode) return `asked for ${mode}, got ${rulebook.mode}`;
    if (mode === 'omniscient') return exported.knowledge === 'full' || 'omniscient rulebook from a player export';
    const found = trace(rulebook);
    return found === undefined || `player rulebook carries ${found}`;
  },
};
