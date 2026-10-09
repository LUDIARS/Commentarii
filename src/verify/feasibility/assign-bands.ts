// Solutions -> feasibility bands (design 8.5, spec/feature/intent-verify.md 6.2), overall and
// per persona, from player-mode runs only:
//   feasible    some persona has min_runs attempts, and every such persona succeeds at least
//               feasible_success of the time
//   extreme     succeeded at least once, but not feasible
//   illusory    never succeeded, yet visible (generated as a candidate from the player export)
//   impossible  never succeeded and not visible
// An illusory solution the intent declares illusory_by_design carries by_design and is kept
// apart by the reports.

import type { IllusoryByDesign } from '../../domain/documents.ts';
import { followsPath } from '../intent/intent-rules.ts';
import type { SolutionCluster } from './cluster-solutions.ts';
import type { Band, FeasibilitySolution, PersonaBand } from './feasibility-document.ts';
import type { FeasibilityThresholds } from './thresholds.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:e9f3f7ea */
import augurContract_b9dfa090 from '../../contracts/assign-bands.contract.ts'; /* augur-inject:contract-predicate:fe11d21c */

export interface BandInput {
  readonly solutions: readonly (SolutionCluster & { readonly visible: boolean })[];
  readonly thresholds: FeasibilityThresholds;
  readonly byDesign: readonly IllusoryByDesign[];
}

interface Tally {
  readonly attempts: number;
  readonly successes: number;
}

function rate(tally: Tally): number | null {
  return tally.attempts === 0 ? null : Math.round((tally.successes / tally.attempts) * 1e6) / 1e6;
}

function bandOf(tallies: readonly Tally[], visible: boolean, thresholds: FeasibilityThresholds): Band {
  const judged = tallies.filter((tally) => tally.attempts >= thresholds.min_runs);
  if (judged.length > 0 && judged.every((tally) => tally.successes / tally.attempts >= thresholds.feasible_success)) return 'feasible';
  if (tallies.some((tally) => tally.successes > 0)) return 'extreme';
  return visible ? 'illusory' : 'impossible';
}

function personaTallies(solution: SolutionCluster): Map<string, Tally> {
  const tallies = new Map<string, { attempts: number; successes: number }>();
  for (const member of solution.members) {
    const tally = tallies.get(member.persona) ?? { attempts: 0, successes: 0 };
    tally.attempts += 1;
    if (member.reached) tally.successes += 1;
    tallies.set(member.persona, tally);
  }
  return new Map([...tallies].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function declared(solution: SolutionCluster, byDesign: readonly IllusoryByDesign[]): IllusoryByDesign | undefined {
  return byDesign.find((entry) => {
    const tactics = entry.tactics === undefined || JSON.stringify(entry.tactics) === JSON.stringify(solution.tactics);
    const route = entry.route === undefined || followsPath(solution.route, entry.route);
    return tactics && route;
  });
}

export function assignBands(input: BandInput): FeasibilitySolution[] {
  return input.solutions.map((solution) => {
    const tallies = personaTallies(solution);
    const personas: PersonaBand[] = [...tallies].map(([persona, tally]) => ({
      persona,
      attempts: tally.attempts,
      successes: tally.successes,
      success_rate: rate(tally),
      band: bandOf([tally], solution.visible, input.thresholds),
    }));
    const band = bandOf([...tallies.values()], solution.visible, input.thresholds);
    const design = band === 'illusory' ? declared(solution, input.byDesign) : undefined;
    return {
      id: solution.id,
      tactics: solution.tactics,
      route: solution.route,
      band,
      visible: solution.visible,
      ...(design === undefined ? {} : { by_design: { rationale: design.rationale, decided_by: design.decided_by } }),
      intended: solution.intended,
      personas,
      evidence_runs: [...new Set(solution.members.map((member) => member.run))].sort(),
    };
  });
}
// @ts-expect-error augur-inject
assignBands = contract(assignBands, { ...augurContract_b9dfa090, contractId: 'C-53', mode: 'observe', sample: 1, where: 'src/verify/feasibility/assign-bands.ts:58', rule: 'contract-wrap', id: 'b9dfa090' }); /* augur-inject:contract-wrap:b9dfa090 */
