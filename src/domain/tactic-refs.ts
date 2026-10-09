// Which IDs a tactic points at. when / do / expect are adapter-level structures, so every
// string in them that has ID shape counts as a reference; `$enemy` style bindings do not.

import type { Tactic } from './documents.ts';
import { isNodeId, parseRef } from './id.ts';

function collectIdStrings(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    if (parseRef(value) !== undefined || isNodeId(value)) into.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectIdStrings(item, into);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) collectIdStrings(item, into);
  }
}

/** All references of a tactic, sorted and de-duplicated. superseded_by is not a reference. */
export function collectTacticRefs(tactic: Tactic): string[] {
  const refs = new Set<string>();
  collectIdStrings(tactic.when, refs);
  collectIdStrings(tactic.do, refs);
  collectIdStrings(tactic.expect, refs);
  for (const reason of tactic.because) refs.add(reason);
  return [...refs].sort();
}
