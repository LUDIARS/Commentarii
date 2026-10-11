// Knowledge boundary (design 1 principle 1, design 5).
// Every value is either knowable by the player (shown / discoverable) or must stay hidden (masked).

export type Knowledge = 'shown' | 'discoverable' | 'masked';

export const KNOWLEDGE_LEVELS: readonly Knowledge[] = ['shown', 'discoverable', 'masked'];

const STRICTNESS: Readonly<Record<Knowledge, number>> = { shown: 0, discoverable: 1, masked: 2 };

export function isKnowledge(value: unknown): value is Knowledge {
  return value === 'shown' || value === 'discoverable' || value === 'masked';
}

/** The strictest label wins: referencing a single masked value makes the whole thing masked. */
export function strictestKnowledge(levels: readonly Knowledge[]): Knowledge | undefined {
  let strictest: Knowledge | undefined;
  for (const level of levels) {
    if (strictest === undefined || STRICTNESS[level] > STRICTNESS[strictest]) strictest = level;
  }
  return strictest;
}

export function isPlayerKnowable(level: Knowledge): boolean {
  return level !== 'masked';
}
