
import { isDeepStrictEqual } from 'node:util';
import type { FilePatch } from '../learn/consolidate/proposal.ts';
import { contentHash } from '../learn/approval/proposal-hash.ts';
import { findLevelFindings, type FindingTarget, type LevelGate, type LevelQuality } from './level-reports.ts';

const CHOICE_FINDINGS = new Set(['no-choice', 'false-choice', 'overload']);
import { contract } from '#contract-runtime'; /* augur-inject:import:734f51da */
import augurContract_423e8be4 from '../contracts/level-authoring-114.contract.ts'; /* augur-inject:contract-predicate:1ef7c2b4 */

export interface LevelTrial {
  readonly proposal: string;
  readonly base: string;
  readonly head: string;
  readonly finding: FindingTarget;
  readonly files: readonly FilePatch[];
}

export interface LevelReview {
  readonly proposal: string;
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly base_report: string;
  readonly head_report: string;
  readonly gate_report: string;
  readonly retained?: readonly FilePatch[];
}

export function reviewLevelTrial(trial: LevelTrial, base: LevelQuality, head: LevelQuality, gate: LevelGate): LevelReview {
  const reasons: string[] = [];
  if (base.versions.bundle_hash !== trial.base || head.versions.bundle_hash !== trial.head || trial.base === trial.head) {
    reasons.push('probe bundle hashes do not match the original and the proposed copy');
  }
  if (!gate.comparable || !isDeepStrictEqual(base.compatibility, head.compatibility) ||
      !isDeepStrictEqual(base.gate_thresholds, head.gate_thresholds)) reasons.push('measurements are not comparable');
  if (gate.candidates.length > 0) reasons.push('gate found regression candidates');

  const target = (entry: FindingTarget): boolean => entry.stage === trial.finding.stage &&
    entry.challenge === trial.finding.challenge && entry.rule === trial.finding.rule && entry.finding.id === trial.finding.finding.id;
  if (!findLevelFindings(base).some((entry) => target(entry) && entry.finding.severity === 'bad' &&
      entry.finding.evidence === trial.finding.finding.evidence)) reasons.push('original probe does not confirm the target finding');
  const challenge = head.challenges.find(({ id, stage }) => id === trial.finding.challenge && stage === trial.finding.stage);
  const measured = trial.finding.challenge === undefined ? head.stages.find(({ id }) => id === trial.finding.stage) : challenge;
  const missingChoices = CHOICE_FINDINGS.has(trial.finding.finding.id) && challenge?.choice.total === 0;
  if (measured === undefined || measured.not_measured.length > 0 || challenge?.undetermined || missingChoices) {
    reasons.push('target was missing or incompletely measured in the proposed copy');
  }
  if (trial.finding.rule !== undefined && !head.priors?.answers.some(({ rule, classification }) =>
    rule === trial.finding.rule && classification !== 'undetermined')) {
    reasons.push('proposed copy has no LLM evidence for the target finding');
  }
  if (findLevelFindings(head).some((entry) => target(entry) && entry.finding.severity !== 'good')) {
    reasons.push('target finding remains in the proposed copy');
  }
  const accepted = reasons.length === 0;
  return { proposal: trial.proposal, accepted, reasons, base_report: contentHash(base),
    head_report: contentHash(head), gate_report: contentHash(gate), ...(accepted ? { retained: trial.files } : {}) };
}
// @ts-expect-error augur-inject
reviewLevelTrial = contract(reviewLevelTrial, { ...augurContract_423e8be4, contractId: 'C-114', mode: 'observe', sample: 1, where: 'src/level/review-level-trial.ts:25', rule: 'contract-wrap', id: '423e8be4' }); /* augur-inject:contract-wrap:423e8be4 */
