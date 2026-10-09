// manifest learning.policy (design 4.4) as guide learn reads it. The manifest schema already
// fixes its shape; a bundle without it cannot be learned from, which is an error rather than
// a silent default (coding conventions 6: no fallback on a missing setting).

import type { Manifest } from '../../domain/documents.ts';
import { isJsonObject } from '../../domain/value-node.ts';
import { LearnError } from '../learn-error.ts';

export interface MetricWeights {
  readonly time: number;
  readonly resource: number;
  readonly risk: number;
}

export interface LearningPolicy {
  readonly exploration_rate: number;
  readonly rewrite: {
    readonly min_runs: number;
    readonly min_gain: number;
    readonly metric_weights: MetricWeights;
    readonly auto_apply: boolean;
  };
  readonly promotion: { readonly discoverable_requires: { readonly player_runs: number; readonly agreement: number } };
}

function isPolicy(value: unknown): value is LearningPolicy {
  if (!isJsonObject(value) || !isJsonObject(value.rewrite) || !isJsonObject(value.promotion)) return false;
  const { rewrite, promotion } = value;
  return (
    typeof value.exploration_rate === 'number' &&
    typeof rewrite.min_runs === 'number' &&
    typeof rewrite.min_gain === 'number' &&
    typeof rewrite.auto_apply === 'boolean' &&
    isJsonObject(rewrite.metric_weights) &&
    isJsonObject(promotion.discoverable_requires)
  );
}

export function learningPolicyOf(manifest: Manifest | undefined): LearningPolicy {
  const policy = manifest?.learning?.policy;
  if (!isPolicy(policy)) throw new LearnError('the bundle manifest has no valid learning.policy (design 4.4); guide learn needs it');
  return policy;
}
