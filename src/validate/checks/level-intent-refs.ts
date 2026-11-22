
import type { LevelIntent } from '@ludiars/commentarii-sdk/types';
import { error, type Finding } from '../check.ts';

export function levelIntentRefs(level: LevelIntent, actions: ReadonlySet<string>, path: string, pointer: string): Finding[] {
  const findings: Finding[] = [];
  for (const [kind, rows] of [['solutions', level.solutions], ['decisions', level.decisions], ['random', level.random]] as const) {
    const ids = new Set<string>();
    rows?.forEach(({ id }, index) => {
      if (ids.has(id)) findings.push(error(path, `${pointer}/${kind}/${index}/id`, `duplicate level ID ${id}`));
      ids.add(id);
    });
  }
  level.solutions?.forEach(({ rules }, solution) => {
    rules.forEach(({ action }, index) => {
      if (!actions.has(action)) findings.push(error(path, `${pointer}/solutions/${solution}/rules/${index}/action`, `${action} does not exist`));
    });
  });
  const sources = new Set(level.random?.map(({ id }) => id));
  level.random?.forEach(({ id, overlaps }, position) => {
    overlaps?.forEach((other, index) => {
      if (!sources.has(other) || other === id) findings.push(error(path, `${pointer}/random/${position}/overlaps/${index}`,
        `${other} must name another random source in this challenge`));
    });
  });
  return findings;
}
