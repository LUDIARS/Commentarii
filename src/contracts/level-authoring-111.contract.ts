import type { SkeletonIssue } from '../level/check-level-skeleton.ts';
import type { Intent } from '@ludiars/commentarii-sdk/types';

export default { post: (result: readonly SkeletonIssue[], intents: readonly Intent[]) =>
  result.every((issue) => /^P(?:[1-9]|10)$/.test(issue.principle) &&
    intents.some((intent) => intent.stage === issue.stage && intent.intended.some((item) => item.id === issue.intent))) };
