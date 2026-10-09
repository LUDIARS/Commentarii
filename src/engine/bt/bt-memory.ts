// Per-node execution state of a running tree, kept outside the tree as an explicit immutable
// map (no globals): node id -> what that node remembers between ticks.

export interface NodeMemory {
  /** Sequence: index of the child to resume. Selector: index of the child that ran last. */
  readonly cursor?: number;
  /** Action (wait): t at which the leaf started. */
  readonly startedT?: number;
}

export type BtMemory = ReadonlyMap<number, NodeMemory>;

export const EMPTY_MEMORY: BtMemory = new Map();

export function withMemory(memory: BtMemory, id: number, entry: NodeMemory): BtMemory {
  const next = new Map(memory);
  next.set(id, entry);
  return next;
}

/** Forgets every node in the id range [from, to] (one subtree). */
export function clearRange(memory: BtMemory, from: number, to: number): BtMemory {
  if (![...memory.keys()].some((id) => id >= from && id <= to)) return memory;
  return new Map([...memory].filter(([id]) => id < from || id > to));
}
