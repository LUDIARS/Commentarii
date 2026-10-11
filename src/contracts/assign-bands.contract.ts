// C-53 assignBands(input): impossible exactly when the map proves the route unwalkable;
// otherwise a solution with no finished attempt is not-observed, one with a success is feasible,
// skill-gated or extreme, and one without is illusory only when visible with enough finished
// attempts (95% upper bound below zero_success_upper), else insufficient-evidence; feasible only
// when every persona with min_runs finished attempts reaches feasible_success; aborted runs are
// never in the denominator; by_design only on illusory (Astra review P1-3).

import type { BandInput } from '../verify/feasibility/assign-bands.ts';
import type { FeasibilitySolution } from '../verify/feasibility/feasibility-document.ts';

export default {
  post: (result: readonly FeasibilitySolution[], input: BandInput) => {
    if (result.length !== input.solutions.length) return 'a solution was dropped or added';
    for (const [index, solution] of result.entries()) {
      const source = input.solutions[index];
      if (source === undefined || source.id !== solution.id) return `solution order changed at ${index}`;
      const finished = source.members.filter((member) => member.completed);
      const successes = finished.filter((member) => member.reached).length;
      if (solution.evidence.attempts !== finished.length) return `${solution.id} counts ${solution.evidence.attempts} attempts, ${finished.length} finished`;
      if ((solution.band === 'impossible') !== (source.unwalkable !== undefined)) return `${solution.id} is ${solution.band} with unwalkable=${source.unwalkable ?? 'none'}`;
      if (source.unwalkable === undefined && finished.length === 0 && solution.band !== 'not-observed') return `${solution.id} has no finished attempt but is ${solution.band}`;
      if (source.unwalkable === undefined && successes > 0 && !['feasible', 'skill-gated', 'extreme'].includes(solution.band)) return `${solution.id} succeeded ${successes} time(s) but is ${solution.band}`;
      if (solution.band === 'illusory' && (!source.visible || successes > 0 || (solution.evidence.interval?.[1] ?? 1) >= input.thresholds.zero_success_upper)) return `${solution.id} is illusory without enough visible failed attempts`;
      if (solution.band === 'feasible') {
        const judged = solution.personas.filter((persona) => persona.attempts >= input.thresholds.min_runs);
        if (judged.length === 0 || judged.some((persona) => persona.successes / persona.attempts < input.thresholds.feasible_success)) return `${solution.id} is feasible below the threshold`;
      }
      if (solution.by_design !== undefined && solution.band !== 'illusory') return `${solution.id} carries by_design while ${solution.band}`;
    }
    return true;
  },
};
