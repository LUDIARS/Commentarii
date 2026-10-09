// Stage traces -> solutions (design 8.5 "解法のまとまり", spec/feature/intent-verify.md 6.1).
// Deterministic: traces sorted by tactic sequence, route and run; each joins the first solution
// with the same tactic sequence whose route is a prefix of its own or the other way round (a
// failed partial attempt joins the solution it was heading for), else starts a new one. A
// solution's route is the longest of its members. Intended solutions no trace reproduces are
// added with no members, so their band can still be judged.

import { followsPath } from '../intent/intent-rules.ts';
import type { StageTrace } from '../runs/stage-trace.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:56ba5c58 */
import augurContract_ecc522d1 from '../../contracts/cluster-solutions.contract.ts'; /* augur-inject:contract-predicate:60656200 */

export interface IntendedSolution {
  readonly intent: string;
  /** teach: [tactic]; route: []. */
  readonly tactics: readonly string[];
  /** route: path; teach: []. */
  readonly route: readonly string[];
}

export interface SolutionCluster {
  readonly id: string;
  readonly tactics: readonly string[];
  readonly route: readonly string[];
  readonly members: readonly StageTrace[];
  readonly intended: readonly string[];
}

interface Draft {
  readonly tactics: readonly string[];
  route: readonly string[];
  readonly members: StageTrace[];
  readonly intended: string[];
}

export function isPrefix(prefix: readonly string[], of: readonly string[]): boolean {
  return prefix.length <= of.length && prefix.every((node, index) => of[index] === node);
}

function key(trace: StageTrace): string {
  return JSON.stringify([trace.tactics, trace.route, trace.run]);
}

function sameTactics(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tactic, index) => b[index] === tactic);
}

function reproduces(draft: Draft, solution: IntendedSolution): boolean {
  if (solution.tactics.length > 0) return solution.tactics.every((tactic) => draft.tactics.includes(tactic));
  return draft.members.some((member) => followsPath(member.route, solution.route));
}

export function clusterSolutions(stageSlug: string, traces: readonly StageTrace[], intended: readonly IntendedSolution[]): SolutionCluster[] {
  const drafts: Draft[] = [];
  for (const trace of [...traces].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))) {
    const home = drafts.find((draft) => sameTactics(draft.tactics, trace.tactics) && (isPrefix(draft.route, trace.route) || isPrefix(trace.route, draft.route)));
    if (home === undefined) drafts.push({ tactics: trace.tactics, route: trace.route, members: [trace], intended: [] });
    else {
      home.members.push(trace);
      if (trace.route.length > home.route.length) home.route = trace.route;
    }
  }
  for (const solution of intended) {
    const homes = drafts.filter((draft) => reproduces(draft, solution));
    if (homes.length === 0) drafts.push({ tactics: solution.tactics, route: solution.route, members: [], intended: [solution.intent] });
    for (const home of homes) home.intended.push(solution.intent);
  }
  return drafts.map((draft, index) => ({
    id: `sol:${stageSlug}:${index + 1}`,
    tactics: [...draft.tactics],
    route: [...draft.route],
    members: draft.members,
    intended: [...new Set(draft.intended)].sort(),
  }));
}
// @ts-expect-error augur-inject
clusterSolutions = contract(clusterSolutions, { ...augurContract_ecc522d1, contractId: 'C-56', mode: 'observe', sample: 1, where: 'src/verify/feasibility/cluster-solutions.ts:51', rule: 'contract-wrap', id: 'ecc522d1' }); /* augur-inject:contract-wrap:ecc522d1 */
