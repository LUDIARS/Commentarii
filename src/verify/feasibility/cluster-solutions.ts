// Stage traces -> solutions (design 8.5 "解法のまとまり", spec/feature/intent-verify.md 6.1). An
// order-independent equivalence (Astra review P2-8): traces with the same tactic sequence and the
// same route are one class. A class whose members all failed and whose route is a strict prefix of
// the route of exactly one class with the same tactics and at least one success is the partial
// attempt of that solution and joins it; otherwise it stays its own solution. The result depends
// on the set of traces only, never on their order; solution numbers follow the sorted (tactics,
// route) keys. Intended solutions no trace reproduces are added with no members, so their band
// can still be judged.

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

function classKey(tactics: readonly string[], route: readonly string[]): string {
  return JSON.stringify([tactics, route]);
}

function sameTactics(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tactic, index) => b[index] === tactic);
}

function equivalenceClasses(traces: readonly StageTrace[]): Draft[] {
  const classes = new Map<string, Draft>();
  for (const trace of traces) {
    const id = classKey(trace.tactics, trace.route);
    const found = classes.get(id);
    if (found === undefined) classes.set(id, { tactics: trace.tactics, route: trace.route, members: [trace], intended: [] });
    else found.members.push(trace);
  }
  return [...classes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, draft]) => draft);
}

/** The one successful class a failed partial class extends, if exactly one does. */
function extensionOf(partial: Draft, classes: readonly Draft[]): Draft | undefined {
  if (partial.members.some((member) => member.reached)) return undefined;
  const homes = classes.filter(
    (other) => other !== partial && sameTactics(other.tactics, partial.tactics) && other.route.length > partial.route.length && isPrefix(partial.route, other.route) && other.members.some((member) => member.reached),
  );
  return homes.length === 1 ? homes[0] : undefined;
}

function reproduces(draft: Draft, solution: IntendedSolution): boolean {
  if (solution.tactics.length > 0) return solution.tactics.every((tactic) => draft.tactics.includes(tactic));
  return draft.members.some((member) => followsPath(member.route, solution.route));
}

export function clusterSolutions(stageSlug: string, traces: readonly StageTrace[], intended: readonly IntendedSolution[]): SolutionCluster[] {
  const classes = equivalenceClasses(traces);
  const drafts: Draft[] = [];
  const joins = new Map<Draft, Draft>();
  for (const draft of classes) {
    const home = extensionOf(draft, classes);
    if (home === undefined) drafts.push({ ...draft, members: [...draft.members] });
    else joins.set(draft, home);
  }
  for (const [partial, home] of joins) {
    const target = drafts.find((draft) => draft.tactics === home.tactics && draft.route === home.route);
    target?.members.push(...partial.members);
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
    members: [...draft.members].sort((x, y) => (x.run < y.run ? -1 : x.run > y.run ? 1 : 0)),
    intended: [...new Set(draft.intended)].sort(),
  }));
}
// @ts-expect-error augur-inject
clusterSolutions = contract(clusterSolutions, { ...augurContract_ecc522d1, contractId: 'C-56', mode: 'observe', sample: 1, where: 'src/verify/feasibility/cluster-solutions.ts:51', rule: 'contract-wrap', id: 'ecc522d1' }); /* augur-inject:contract-wrap:ecc522d1 */
