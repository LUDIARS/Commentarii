import type { LevelReview, LevelTrial } from '../level/review-level-trial.ts';
import type { LevelGate, LevelQuality } from '../level/level-reports.ts';

export default { post: (result: LevelReview, trial: LevelTrial, base: LevelQuality, head: LevelQuality, gate: LevelGate) =>
  !result.accepted || (gate.comparable && gate.candidates.length === 0 && result.proposal === trial.proposal &&
    base.versions.bundle_hash === trial.base && head.versions.bundle_hash === trial.head && result.reasons.length === 0) };
