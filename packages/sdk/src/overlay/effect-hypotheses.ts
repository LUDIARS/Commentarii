// observations/rules/<action-slug>.json (schema/effect-hypotheses.schema.json, Ingenium R2): what
// an engine estimated about an action's effect from the before / after difference of player
// observations. Estimates, not truths: confounded and censored samples are counted apart, a
// holdout checks the estimate, a hypothesis can be retracted, and promotion to the canonical
// rulebook goes through Commentarii's approval path (approved_for_canonical is always false).

export const EFFECT_HYPOTHESES_FORMAT = 'effect-hypotheses/1';

/** Bundle-relative directory of the effect hypothesis files. */
export const EFFECT_HYPOTHESES_DIR = 'observations/rules';

export interface DeltaRange {
  readonly lo: number;
  readonly hi: number;
}

export interface EffectHypothesis {
  /** hypothesis:<game>:<slug> */
  readonly id: string;
  readonly action: string;
  /** Whose quantity changes: the action's target or its actor. */
  readonly role: 'target' | 'actor';
  /** Observation-frame path the quantity is read from (e.g. self.hp.value). */
  readonly observable: string;
  readonly unit?: string;
  /** expr/2 condition the samples were taken under ("1" = unconditional). */
  readonly condition: string;
  /** What the rulebook the engine played with predicts for one occurrence. */
  readonly predicted_delta: DeltaRange;
  readonly observed_delta: DeltaRange & { readonly mean: number; readonly sd: number };
  /** Confidence interval of the mean change. */
  readonly interval: DeltaRange & { readonly level: number };
  /** Estimation samples (holdout excluded). */
  readonly samples: number;
  readonly evidence: { readonly completed: number; readonly censored: number; readonly confounded: number };
  readonly holdout: { readonly samples: number; readonly mean?: number; readonly inside: boolean };
  readonly runs: readonly string[];
  readonly status: 'provisional' | 'retracted';
  readonly retracted_because?: string;
  readonly knowledge: 'discoverable';
  readonly source: { readonly kind: 'observed'; readonly ref: string };
  readonly approved_for_canonical: false;
}

export interface EffectHypothesesFile {
  readonly format: typeof EFFECT_HYPOTHESES_FORMAT;
  readonly game_id: string;
  readonly action: string;
  readonly runs: { readonly player: readonly string[]; readonly ignored_omniscient: readonly string[] };
  readonly hypotheses: readonly EffectHypothesis[];
}

/** observations/rules/<slug>.json of an action ID (action:<game>:<slug>). */
export function effectHypothesesPath(actionId: string): string {
  const slug = actionId.split(':').at(-1);
  if (slug === undefined || slug === '') throw new Error(`not an action ID: ${actionId}`);
  return `${EFFECT_HYPOTHESES_DIR}/${slug}.json`;
}
