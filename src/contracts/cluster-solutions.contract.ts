// C-56 clusterSolutions(stageSlug, traces, intended): every trace is in exactly one solution;
// inside a solution every member has the solution's tactic sequence and a route that is a prefix
// of the solution's route; IDs are unique sol:<stage-slug>:<n>; every intended solution is named
// by at least one solution.

import { isPrefix, type IntendedSolution, type SolutionCluster } from '../verify/feasibility/cluster-solutions.ts';
import type { StageTrace } from '../verify/runs/stage-trace.ts';

export default {
  post: (result: readonly SolutionCluster[], stageSlug: string, traces: readonly StageTrace[], intended: readonly IntendedSolution[]) => {
    const seen = new Map<StageTrace, number>();
    for (const solution of result) {
      if (!solution.id.startsWith(`sol:${stageSlug}:`)) return `${solution.id} is not a solution ID of ${stageSlug}`;
      for (const member of solution.members) {
        seen.set(member, (seen.get(member) ?? 0) + 1);
        if (JSON.stringify(member.tactics) !== JSON.stringify(solution.tactics)) return `${member.run} has other tactics than ${solution.id}`;
        if (!isPrefix(member.route, solution.route)) return `the route of ${member.run} is not a prefix of the route of ${solution.id}`;
      }
    }
    if (new Set(result.map((solution) => solution.id)).size !== result.length) return 'duplicate solution IDs';
    for (const trace of traces) if (seen.get(trace) !== 1) return `${trace.run} is in ${seen.get(trace) ?? 0} solution(s)`;
    for (const solution of intended) if (!result.some((cluster) => cluster.intended.includes(solution.intent))) return `${solution.intent} is in no solution`;
    return true;
  },
};
