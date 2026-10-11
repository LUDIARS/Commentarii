// The abstract action the engine hands back to the adapter (design 7.3). Exactly one verb key;
// its operand is a bundle ID / node ID, an entity instance number, a position, or (wait) seconds.

export const ACTION_VERBS = ['move_to', 'attack', 'use_item', 'use_skill', 'wait', 'interact', 'custom'] as const;

export type ActionVerb = (typeof ACTION_VERBS)[number];

export type ActionOperand = string | number | readonly number[];

export type ReplayAction = { readonly [verb in ActionVerb]?: ActionOperand } & {
  readonly target?: ActionOperand;
  readonly params?: Readonly<Record<string, unknown>>;
};
