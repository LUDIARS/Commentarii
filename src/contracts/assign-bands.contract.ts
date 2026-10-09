// C-53 assignBands(input): a solution with a success is feasible or extreme; illusory only when
// the solution is visible (generated from the player export) and never succeeded; impossible only
// when it is not visible and never succeeded; feasible only when every persona with min_runs
// attempts reaches feasible_success; by_design only on illusory.

import type { BandInput } from '../verify/feasibility/assign-bands.ts';
import type { FeasibilitySolution } from '../verify/feasibility/feasibility-document.ts';

export default {
  post: (result: readonly FeasibilitySolution[], input: BandInput) => {
    if (result.length !== input.solutions.length) return 'a solution was dropped or added';
    for (const [index, solution] of result.entries()) {
      const source = input.solutions[index];
      if (source === undefined || source.id !== solution.id) return `solution order changed at ${index}`;
      const successes = source.members.filter((member) => member.reached).length;
      if (successes > 0 && solution.band !== 'feasible' && solution.band !== 'extreme') return `${solution.id} succeeded ${successes} time(s) but is ${solution.band}`;
      if (solution.band === 'illusory' && (!source.visible || successes > 0)) return `${solution.id} is illusory without being visible with no success`;
      if (solution.band === 'impossible' && (source.visible || successes > 0)) return `${solution.id} is impossible while visible or successful`;
      if (solution.band === 'feasible') {
        const judged = solution.personas.filter((persona) => persona.attempts >= input.thresholds.min_runs);
        if (judged.length === 0 || judged.some((persona) => persona.successes / persona.attempts < input.thresholds.feasible_success)) return `${solution.id} is feasible below the threshold`;
      }
      if (solution.by_design !== undefined && solution.band !== 'illusory') return `${solution.id} carries by_design while ${solution.band}`;
    }
    return true;
  },
};
