// Counts of what an import left out or could not resolve (unmapped inputs, unidentified
// entities, ...), reported on stderr so that a mapping gap is visible instead of silent.

export type ImportTally = Map<string, number>;

export function createTally(): ImportTally {
  return new Map();
}

export function countIn(tally: ImportTally, what: string): void {
  tally.set(what, (tally.get(what) ?? 0) + 1);
}

/** In name order, for deterministic output. */
export function tallyEntries(tally: ImportTally): [string, number][] {
  return [...tally].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
