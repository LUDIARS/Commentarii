// V15: the outcomes of every effect (visible actions and masked overrides alike) are one draw:
// their p add up to 1. A visible effect whose outcomes fall short would leave room for a hidden
// branch, so the shortfall is an error, not "unknown".

import type { Effect } from '@ludiars/commentarii-sdk/types';
import { error, type Check, type Finding } from '../check.ts';

const TOLERANCE = 1e-9;

function effectFindings(path: string, pointer: string, effects: readonly Effect[] | undefined): Finding[] {
  return (effects ?? []).flatMap((effect, i) => {
    const sum = effect.outcomes.reduce((total, outcome) => total + outcome.p, 0);
    return Math.abs(sum - 1) > TOLERANCE ? [error(path, `${pointer}/${i}/outcomes`, `outcome probabilities add up to ${sum}, not 1`)] : [];
  });
}

export const v15OutcomeProbabilities: Check = {
  id: 'V15',
  title: '効果の確率の合計が 1',
  run: ({ load }) => {
    const { rulebook } = load.bundle;
    return [
      ...rulebook.actions.flatMap(({ path, doc }) => effectFindings(path, '/effects', doc.effects)),
      ...rulebook.maskedActions.flatMap(({ path, doc }) => effectFindings(path, '/override/effects', doc.override.effects)),
    ];
  },
};
