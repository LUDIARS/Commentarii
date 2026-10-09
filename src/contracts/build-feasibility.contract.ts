// C-54 buildFeasibility(input): no omniscient run is counted or used as evidence; breadth is the
// number of non-illusory / non-impossible solutions the persona succeeded with; convergence holds
// exactly when breadth is 1 and the stance is not refined; confusion depth is never negative.

import type { FeasibilityInput } from '../verify/feasibility/build-feasibility.ts';
import type { FeasibilityDocument } from '../verify/feasibility/feasibility-document.ts';

export default {
  post: (result: FeasibilityDocument, input: FeasibilityInput) => {
    const omniscient = new Set(input.ignoredOmniscient);
    for (const run of result.runs.counted) if (omniscient.has(run)) return `omniscient ${run} is counted`;
    for (const solution of result.solutions) for (const run of solution.evidence_runs) if (omniscient.has(run)) return `omniscient ${run} is evidence of ${solution.id}`;
    for (const axis of result.axes) {
      const breadth = result.solutions.filter(
        (solution) => solution.band !== 'illusory' && solution.band !== 'impossible' && solution.personas.some((persona) => persona.persona === axis.persona && persona.successes > 0),
      ).length;
      if (axis.breadth !== breadth) return `breadth of ${axis.persona} is ${axis.breadth}, expected ${breadth}`;
      if (axis.convergence !== (axis.breadth === 1 && result.design_stance !== 'refined')) return `convergence of ${axis.persona} does not follow breadth and stance`;
      if (!(axis.confusion_depth >= 0)) return `confusion depth of ${axis.persona} is ${axis.confusion_depth}`;
    }
    return true;
  },
};
