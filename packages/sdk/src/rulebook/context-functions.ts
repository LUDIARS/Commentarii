// The context function vocabulary of rulebook expressions (spec/feature/rulebook.md §1). The
// SDK fixes the names and argument counts so validate can check them; the meaning is supplied
// by the evaluator (Ingenium's belief) through IntervalContext.functions. Besides these, every
// variable owned by self / entity is a one-argument function (`hp(x)`) and every set is a
// membership predicate (`hostile(x)`).

export interface ContextFunctionSpec {
  readonly name: string;
  readonly minArgs: number;
  readonly maxArgs: number;
  /** What the first argument must be, when it is not a plain value. */
  readonly first?: 'owner' | 'rule' | 'set' | 'variable' | 'action';
  readonly meaning: string;
}

export const CONTEXT_FUNCTIONS: readonly ContextFunctionSpec[] = [
  { name: 'dist', minArgs: 2, maxArgs: 2, meaning: 'distance between two owners or points (m)' },
  { name: 'rule', minArgs: 1, maxArgs: 1, first: 'rule', meaning: 'value of a rule document evaluated with the current variables' },
  { name: 'ready', minArgs: 1, maxArgs: 2, meaning: 'ready(action) / ready(owner, action): the action is off cooldown for the actor' },
  { name: 'visible', minArgs: 1, maxArgs: 1, first: 'owner', meaning: 'the owner is in the observation' },
  { name: 'kind', minArgs: 1, maxArgs: 1, first: 'owner', meaning: 'entity kind of the owner (a symbol such as enemy)' },
  { name: 'has', minArgs: 1, maxArgs: 1, first: 'variable', meaning: 'the variable has a value (e.g. a stage time limit exists)' },
  { name: 'count', minArgs: 1, maxArgs: 1, first: 'set', meaning: 'number of members of a set' },
  { name: 'sum', minArgs: 2, maxArgs: 2, first: 'set', meaning: 'sum(set, variable) over the members' },
  { name: 'nearest', minArgs: 1, maxArgs: 1, first: 'set', meaning: 'the member of a set nearest to the actor (an owner)' },
  { name: 'node', minArgs: 1, maxArgs: 1, first: 'owner', meaning: 'the map node the owner stands in (a symbol)' },
];

export const CONTEXT_FUNCTION_NAMES: readonly string[] = CONTEXT_FUNCTIONS.map((spec) => spec.name);

/** Bare names every rulebook expression may use: `dt` (sub-step length) as a number, `self` / `actor` as owner symbols. */
export const BUILT_IN_VALUES: readonly string[] = ['dt'];
export const BUILT_IN_OWNERS: readonly string[] = ['self', 'actor'];
