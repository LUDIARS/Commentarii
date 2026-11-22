
import type { Intent } from '@ludiars/commentarii-sdk/types';
import type { LevelPrinciples } from './level-principles.ts';
import { levelRuleId } from './level-rule-id.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:b8298176 */
import augurContract_186eaa3e from '../contracts/level-authoring-111.contract.ts'; /* augur-inject:contract-predicate:31754741 */

export interface SkeletonIssue {
  readonly principle: 'P1' | 'P2' | 'P3' | 'P4' | 'P8' | 'P9';
  readonly stage: string;
  readonly intent: string;
  readonly subject: string;
  readonly reason: string;
}

export function checkLevelSkeleton(intents: readonly Intent[], principles: LevelPrinciples): SkeletonIssue[] {
  const issues: SkeletonIssue[] = [];
  for (const { stage, intended } of intents) {
    for (const item of intended) {
      if ((item.kind !== 'route' && item.kind !== 'teach') || item.level === undefined) continue;
      const { challenge, solutions, decisions, random, feel, disclosure } = item.level;
      const add = (principle: SkeletonIssue['principle'], subject: string, reason: string): void => {
        issues.push({ principle, stage, intent: item.id, subject, reason });
      };
      if (solutions !== undefined) {
        const families = new Set(solutions.map(({ rules }) =>
          JSON.stringify([...new Set(rules.map(levelRuleId))].sort())));
        if (families.size < 2) add('P1', challenge, 'fewer than two distinct intended rule sets');
        if (new Set(solutions.flatMap(({ skills }) => [...skills])).size < 2 ||
            new Set(solutions.flatMap(({ styles }) => [...styles])).size < 2) {
          add('P2', challenge, 'intended solutions cover fewer than two skill tiers or styles');
        }
      }
      if (disclosure === 'discovery' && item.kind === 'teach' && item.hints?.some(({ kind }) => kind === 'solution')) {
        add('P3', challenge, 'solution hint can pre-empt independent discovery');
      }
      for (const { id, options, regime } of decisions ?? []) {
        const band = principles.measure.choice.bands[regime];
        if (options < 2 || options >= band.warning) {
          add('P4', id, options < 2 ? 'fewer than two options' : 'at or above the cognitive-load warning band');
        }
      }
      if (feel === 'flat') add('P8', challenge, 'the intended outcomes leave little room for influence or surprise');
      const byId = new Map((random ?? []).map((source) => [source.id, source]));
      const overlaps = new Set<string>();
      for (const source of byId.values()) {
        for (const other of source.overlaps ?? []) {
          if (source.management !== 'unmanaged' || byId.get(other)?.management !== 'unmanaged') continue;
          const pair = [source.id, other].sort().join('/');
          if (overlaps.has(pair)) continue;
          overlaps.add(pair);
          add('P9', pair, 'overlapping sources are both unmanaged');
        }
      }
    }
  }
  return issues;
}
// @ts-expect-error augur-inject
checkLevelSkeleton = contract(checkLevelSkeleton, { ...augurContract_186eaa3e, contractId: 'C-111', mode: 'observe', sample: 1, where: 'src/level/check-level-skeleton.ts:14', rule: 'contract-wrap', id: '186eaa3e' }); /* augur-inject:contract-wrap:186eaa3e */
