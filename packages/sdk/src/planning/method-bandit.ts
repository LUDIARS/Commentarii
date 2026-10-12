// Statistics of an engine's constrained online correction (schema/method-bandit.schema.json,
// Ingenium R3, SDK 0.5.0): per model version, per situation signature, per arm (the planner that
// leads when both are eligible) the number of goal episodes and the summed reward (each reward
// is 0..1). Versions never mix: a new rulebook, budget table or engine starts from nothing.
// Counts and rewards only (no game values). Written only when the correction is enabled.

import type { BudgetPlannerId } from './planning-proposals.ts';

export const METHOD_BANDIT_FORMAT = 'method-bandit/1';

export interface BanditArmStats {
  readonly n: number;
  readonly total: number;
}

/** arm -> stats of one situation signature. */
export type BanditSignatureStats = Readonly<Partial<Record<BudgetPlannerId, BanditArmStats>>>;

/** One version's statistics: signature -> arm -> stats. */
export type BanditVersionStats = Readonly<Record<string, BanditSignatureStats>>;

export interface MethodBandit {
  readonly format: typeof METHOD_BANDIT_FORMAT;
  readonly versions: Readonly<Record<string, BanditVersionStats>>;
}
