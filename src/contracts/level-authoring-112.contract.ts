import type { Intent } from '@ludiars/commentarii-sdk/types';
import type { Divergence } from '../verify/intent/divergence.ts';
import type { LevelQuality } from '../level/level-reports.ts';

export default { post: (result: readonly Divergence[], intents: readonly Intent[], report: LevelQuality) =>
  new Set(result.map((entry) => entry.id)).size === result.length && result.every((entry) =>
    intents.some((intent) => intent.stage === entry.stage && intent.intended.some((item) => item.id === entry.intent)) &&
    report.challenges.some((challenge) => challenge.id === entry.level?.challenge && challenge.stage === entry.stage)) };
