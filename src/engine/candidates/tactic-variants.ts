// Variants of a tactic for exploration (design 7.4 "定石の変種", stage 4): one per mutation,
// each a full tactic document so the same derivation serves the engine (exploration
// candidates) and guide learn consolidate (the rewrite proposal):
//   reorder     the steps rotated, last step first: the same ingredients in another order.
//   relax       every numeric threshold of `when` loosened by RELAX_FACTOR (not inside `not`,
//               where loosening would tighten).
//   substitute  the first step replaced by the second: one element of `do` swapped for another
//               of the same tactic (skips the first step).
// No mutation brings in a reference the tactic did not have, so a variant keeps the tactic's
// knowledge boundary. A variant is `learned`, unmeasured and not superseded, and its ID is
// `<tactic ID>--<mutation>` (a tactic ID itself, so it can become a canonical tactic).

import { isDeepStrictEqual } from 'node:util';
import type { LocalizedText, Tactic } from '../../domain/documents.ts';
import { isJsonObject } from '../../domain/value-node.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:9eabdc2e */
import augurContract_fe88ecfc from '../../contracts/derive-variant.contract.ts'; /* augur-inject:contract-predicate:165c5463 */

export const TACTIC_MUTATIONS = ['reorder', 'relax', 'substitute'] as const;
export type TacticMutation = (typeof TACTIC_MUTATIONS)[number];

/** Thresholds move 25% toward holding more often. */
export const RELAX_FACTOR = 1.25;

export interface TacticVariant {
  readonly tactic: Tactic;
  /** The tactic the variant was derived from. */
  readonly of: string;
  readonly mutation: TacticMutation;
}

type Step = Tactic['do'][number];

/** Loosen: upper bounds grow, lower bounds shrink. */
type Loosen = (value: number) => number;
const RAISE: Loosen = (value) => value * RELAX_FACTOR;
const LOWER: Loosen = (value) => value / RELAX_FACTOR;
const RAISE_RATIO: Loosen = (value) => Math.min(value * RELAX_FACTOR, 1);

/** Numeric keys of entity / self leaves (engine/match vocabulary) and how each loosens. */
const NUMERIC_KEYS: Readonly<Record<string, Loosen>> = {
  distance_lt: RAISE,
  distance_gt: LOWER,
  min_confidence: LOWER,
  hp_ratio_lt: RAISE_RATIO,
  hp_ratio_gt: LOWER,
};
/** Self keys whose operand is { resource: amount }. */
const RESOURCE_KEYS: Readonly<Record<string, Loosen>> = { resource_gte: LOWER, resource_lt: RAISE };

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function variantId(tacticId: string, mutation: TacticMutation): string {
  return `${tacticId}--${mutation}`;
}

function loosenResources(operand: unknown, loosen: Loosen): unknown {
  if (!isJsonObject(operand)) return operand;
  return Object.fromEntries(Object.entries(operand).map(([name, amount]) => [name, typeof amount === 'number' ? round3(loosen(amount)) : amount]));
}

/** `when` with every numeric threshold loosened, `not` subtrees left as they are. */
function relaxCondition(condition: unknown): unknown {
  if (Array.isArray(condition)) return condition.map(relaxCondition);
  if (!isJsonObject(condition)) return condition;
  const relaxed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(condition)) {
    const loosen = NUMERIC_KEYS[key];
    const resourceLoosen = RESOURCE_KEYS[key];
    if (key === 'not') relaxed[key] = value;
    else if (loosen !== undefined && typeof value === 'number') relaxed[key] = round3(loosen(value));
    else if (resourceLoosen !== undefined) relaxed[key] = loosenResources(value, resourceLoosen);
    else relaxed[key] = relaxCondition(value);
  }
  return relaxed;
}

function reorderSteps(steps: readonly Step[]): readonly Step[] | undefined {
  if (steps.length < 2) return undefined;
  return [...steps.slice(-1), ...steps.slice(0, -1)];
}

function substituteSteps(steps: readonly Step[]): readonly Step[] | undefined {
  const [, second, ...rest] = steps;
  if (second === undefined) return undefined;
  return [second, second, ...rest];
}

function suffixed(name: LocalizedText, mutation: TacticMutation): LocalizedText {
  return Object.fromEntries(Object.entries(name).map(([lang, text]) => [lang, `${text} (${mutation})`]));
}

function changed(origin: Tactic, mutation: TacticMutation): Pick<Tactic, 'when' | 'do'> | undefined {
  if (mutation === 'relax') return { when: relaxCondition(origin.when), do: origin.do };
  const steps = mutation === 'reorder' ? reorderSteps(origin.do) : substituteSteps(origin.do);
  return steps === undefined ? undefined : { when: origin.when, do: steps };
}

/** The variant of `origin` made by `mutation`, or undefined when it would equal the origin. */
export function deriveVariant(origin: Tactic, mutation: TacticMutation): TacticVariant | undefined {
  const body = changed(origin, mutation);
  if (body === undefined || (isDeepStrictEqual(body.when, origin.when) && isDeepStrictEqual(body.do, origin.do))) return undefined;
  const { metrics: _metrics, draft: _draft, ...rest } = origin;
  const tactic: Tactic = {
    ...rest,
    id: variantId(origin.id, mutation),
    name: suffixed(origin.name, mutation),
    when: body.when,
    do: body.do,
    confidence: 'learned',
    superseded_by: null,
  };
  return { tactic, of: origin.id, mutation };
}
// @ts-expect-error augur-inject
deriveVariant = contract(deriveVariant, { ...augurContract_fe88ecfc, contractId: 'C-34', mode: 'observe', sample: 1, where: 'src/engine/candidates/tactic-variants.ts:100', rule: 'contract-wrap', id: 'fe88ecfc' }); /* augur-inject:contract-wrap:fe88ecfc */

/** Every variant of `origin`, in TACTIC_MUTATIONS order. */
export function deriveVariants(origin: Tactic): TacticVariant[] {
  return TACTIC_MUTATIONS.map((mutation) => deriveVariant(origin, mutation)).filter((variant): variant is TacticVariant => variant !== undefined);
}
