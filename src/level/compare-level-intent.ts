
import type { Intent, LevelDivergenceReason, LevelIntent } from '@ludiars/commentarii-sdk/types';
import { divergenceId, KIND_OF_REASON, type Divergence } from '../verify/intent/divergence.ts';
import type { LevelChallenge, LevelQuality } from './level-reports.ts';
import { levelRuleId } from './level-rule-id.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:1beecb05 */
import augurContract_af5817eb from '../contracts/level-authoring-112.contract.ts'; /* augur-inject:contract-predicate:82e53f66 */

type RecordMismatch = (reason: LevelDivergenceReason, subject: string, summary: string) => void;

function rulesKey(rules: readonly string[]): string {
  return JSON.stringify([...new Set(rules)].sort());
}

function compareSolutions(level: LevelIntent, observed: LevelChallenge, add: RecordMismatch): void {
  if (level.solutions === undefined || !observed.solution_measurement) return;
  const expected = new Set<string>();
  for (const solution of level.solutions) {
    const key = rulesKey(solution.rules.map(levelRuleId));
    expected.add(key);
    const matches = observed.classes.filter((entry) => rulesKey(entry.rules) === key);
    const viable = matches.some(({ confirmation }) => confirmation.some(({ status }) => status === 'viable'));
    if (!viable && !observed.undetermined && observed.omitted_classes === 0 &&
        matches.every(({ confirmation }) => confirmation.every(({ status }) => status !== 'undetermined'))) {
      add('blocked-solution', solution.id, 'no confirmed viable class uses the intended rules');
    }
    for (const skill of solution.skills) {
      const statuses = matches.map((entry) => entry.confirmation[skill - 1]?.status);
      if (viable && !observed.undetermined && statuses.every((status) => status === 'unviable')) {
        add('skill-mismatch', `${solution.id}/${skill}`, 'a confirmed solution fails at the intended skill tier');
      }
    }
  }
  for (const entry of observed.classes) {
    if (!expected.has(rulesKey(entry.rules)) && entry.confirmation.some(({ status }) => status === 'viable')) {
      add('unexpected-solution', entry.id, 'a confirmed viable class uses an undeclared rule set');
    }
  }
}

function compareExperience(level: LevelIntent, observed: LevelChallenge, add: RecordMismatch): void {
  if (!observed.experience_measurement || observed.not_measured.includes('spontaneous')) return;
  const play = observed.play_value;
  if (level.disclosure !== undefined && play.total > 0) {
    const mismatch = level.disclosure === 'rule-taught' ? play.rule_taught === 0
      : level.disclosure === 'late' ? play.late_disclosure === 0
      : play.late_disclosure > 0;
    if (mismatch) add('disclosure-mismatch', level.disclosure, 'observed disclosure differs from the intended timing');
  }
  if (!observed.not_measured.includes('outcome-samples') && level.feel !== undefined &&
      observed.outcomes.classification !== 'undetermined' && level.feel !== observed.outcomes.classification) {
    add('feel-mismatch', level.feel, `observed outcomes are ${observed.outcomes.classification}`);
  }
  const { total, counts } = observed.choice;
  if (total === 0 || observed.not_measured.includes('choices-reach')) return;
  // "None" and "false-choice" imply at most one meaningful option.
  const atMostOne = (counts.none ?? 0) + (counts['false-choice'] ?? 0);
  const atLeastTwo = (counts.fit ?? 0) + (counts.crowded ?? 0) + (counts.overload ?? 0);
  for (const decision of level.decisions ?? []) {
    if ((decision.options >= 2 && atMostOne === total) || (decision.options < 2 && atLeastTwo === total)) {
      add('choice-count-mismatch', decision.id, 'all measured decisions fall on the opposite side of the two-option boundary');
    }
  }
}

export function compareLevelIntent(intents: readonly Intent[], report: LevelQuality): Divergence[] {
  const found = new Map<string, Divergence>();
  const byChallenge = new Map(report.challenges.map((challenge) => [challenge.id, challenge]));
  for (const { stage, intended } of intents) {
    for (const item of intended) {
      if ((item.kind !== 'route' && item.kind !== 'teach') || item.level === undefined) continue;
      const observed = byChallenge.get(item.level.challenge);
      if (observed === undefined || observed.stage !== stage) continue;
      const add: RecordMismatch = (reason, subject, summary) => {
        const level = { challenge: observed.id, subject };
        const signature = { tactics: [], route: [] };
        const id = divergenceId(item.id, reason, signature, level);
        found.set(id, { id, stage, intent: item.id, kind: KIND_OF_REASON[reason], reason, summary,
          runs: [], personas: [], signature, level });
      };
      compareSolutions(item.level, observed, add);
      compareExperience(item.level, observed, add);
    }
  }
  return [...found.values()];
}
// @ts-expect-error augur-inject
compareLevelIntent = contract(compareLevelIntent, { ...augurContract_af5817eb, contractId: 'C-112', mode: 'observe', sample: 1, where: 'src/level/compare-level-intent.ts:70', rule: 'contract-wrap', id: 'af5817eb' }); /* augur-inject:contract-wrap:af5817eb */
