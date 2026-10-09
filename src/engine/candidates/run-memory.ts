// What the engine remembers across ticks of one run, besides the running plan: candidates it
// has tried, nodes it has visited, expectations still waiting for their verdict, and tactics
// whose expectation broke (held back for a while).

import type { Bindings } from '../match/bindings.ts';

/** A tactic that ran (or is running) and whose `expect` has not been judged yet. */
export interface ExpectationWatch {
  readonly candidateId: string;
  readonly expect: Readonly<Record<string, unknown>>;
  readonly bindings: Bindings;
  readonly startedT: number;
}

export interface RunMemory {
  readonly tried: ReadonlySet<string>;
  readonly visited: ReadonlySet<string>;
  /** Candidate ID -> its last run's expectation, until it is met or broken. */
  readonly watching: ReadonlyMap<string, ExpectationWatch>;
  /** Candidate ID -> t until which it is not proposed again. */
  readonly heldBackUntil: ReadonlyMap<string, number>;
}

export const EMPTY_RUN_MEMORY: RunMemory = { tried: new Set(), visited: new Set(), watching: new Map(), heldBackUntil: new Map() };

/** Not proposed now: its expectation broke recently, or the last run's verdict is still out. */
export function isHeldBack(memory: RunMemory, candidateId: string, t: number): boolean {
  const until = memory.heldBackUntil.get(candidateId);
  return (until !== undefined && t < until) || memory.watching.has(candidateId);
}
