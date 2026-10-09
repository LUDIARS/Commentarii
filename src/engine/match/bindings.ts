// Bindings: `$name` -> entity instance, produced by matching a tactic's `when` and consumed by
// its `do` (design 4.4: `"target": "$enemy"`). A match result is ok plus what it bound.

import { parseRef } from '../../domain/id.ts';

export type Bindings = Readonly<Record<string, number>>;

export interface MatchResult {
  readonly ok: boolean;
  readonly bindings: Bindings;
}

export const NO_BINDINGS: Bindings = {};

export function matched(bindings: Bindings = NO_BINDINGS): MatchResult {
  return { ok: true, bindings };
}

export function unmatched(): MatchResult {
  return { ok: false, bindings: NO_BINDINGS };
}

export function isBindingName(text: unknown): text is string {
  return typeof text === 'string' && /^\$[a-z][a-z0-9_]*$/.test(text);
}

/** `$enemy` for enemy:..., `$item` for item:... (an explicit `as` overrides it). */
export function defaultBindingName(entityId: string): string | undefined {
  const kind = parseRef(entityId)?.kind;
  return kind === undefined ? undefined : `$${kind}`;
}
