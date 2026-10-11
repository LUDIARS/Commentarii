// Solutions -> feasibility bands (design 8.5, spec/feature/intent-verify.md 6.2), overall and
// per persona, from player-mode runs only. Only finished attempts count (an aborted run proves
// nothing), and "no success" alone never makes a solution illusory or impossible (Astra review P1-3):
//   impossible             the stage map proves the route cannot be walked (route-reachability.ts)
//   not-observed           no finished attempt (outside the classification)
//   feasible               some persona has min_runs finished attempts, and every such persona
//                          succeeds at least feasible_success of the time
//   skill-gated            a judged persona reaches feasible_success while another judged persona
//                          stays below it (the expert succeeds, the novice does not)
//   extreme                succeeded at least once, but none of the above
//   illusory               never succeeded, visible (generated as a candidate from the player
//                          export) and the 95% upper bound of its success rate is below
//                          zero_success_upper (enough finished attempts)
//   insufficient-evidence  never succeeded otherwise (outside the classification)
// Every band carries its sample (finished attempts, successes, rate, interval, seeds, budget).
// An illusory solution the intent declares illusory_by_design carries by_design.

import type { IllusoryByDesign } from '../../domain/documents.ts';
import { followsPath } from '../intent/intent-rules.ts';
import type { StageTrace } from '../runs/stage-trace.ts';
import type { SolutionCluster } from './cluster-solutions.ts';
import type { Band, FeasibilitySolution, PersonaBand } from './feasibility-document.ts';
import { sampleEvidence, type SampleEvidence } from './sample-evidence.ts';
import type { FeasibilityThresholds } from './thresholds.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:e9f3f7ea */
import augurContract_b9dfa090 from '../../contracts/assign-bands.contract.ts'; /* augur-inject:contract-predicate:fe11d21c */

export interface BandInput {
  readonly solutions: readonly (SolutionCluster & { readonly visible: boolean; readonly unwalkable?: string })[];
  readonly thresholds: FeasibilityThresholds;
  readonly byDesign: readonly IllusoryByDesign[];
}

function meets(evidence: SampleEvidence, thresholds: FeasibilityThresholds): boolean {
  return evidence.attempts > 0 && evidence.successes / evidence.attempts >= thresholds.feasible_success;
}

function bandOf(perPersona: readonly SampleEvidence[], overall: SampleEvidence, solution: BandInput['solutions'][number], thresholds: FeasibilityThresholds): Band {
  if (solution.unwalkable !== undefined) return 'impossible';
  if (overall.attempts === 0) return 'not-observed';
  const judged = perPersona.filter((evidence) => evidence.attempts >= thresholds.min_runs);
  if (judged.length > 0 && judged.every((evidence) => meets(evidence, thresholds))) return 'feasible';
  if (judged.some((evidence) => meets(evidence, thresholds))) return 'skill-gated';
  if (overall.successes > 0) return 'extreme';
  const upper = overall.interval?.[1] ?? 1;
  return solution.visible && upper < thresholds.zero_success_upper ? 'illusory' : 'insufficient-evidence';
}

function byPersona(members: readonly StageTrace[]): Map<string, StageTrace[]> {
  const groups = new Map<string, StageTrace[]>();
  for (const member of members) groups.set(member.persona, [...(groups.get(member.persona) ?? []), member]);
  return new Map([...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
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
    const groups = byPersona(solution.members);
    const evidenceOf = new Map([...groups].map(([persona, members]) => [persona, sampleEvidence(members)]));
    const overall = sampleEvidence(solution.members);
    const personas: PersonaBand[] = [...evidenceOf].map(([persona, evidence]) => ({
      persona,
      attempts: evidence.attempts,
      successes: evidence.successes,
      success_rate: evidence.success_rate,
      band: bandOf([evidence], evidence, solution, input.thresholds),
      evidence,
    }));
    const band = bandOf([...evidenceOf.values()], overall, solution, input.thresholds);
    const design = band === 'illusory' ? declared(solution, input.byDesign) : undefined;
    return {
      id: solution.id,
      tactics: solution.tactics,
      route: solution.route,
      band,
      evidence: overall,
      ...(solution.unwalkable === undefined ? {} : { unwalkable: solution.unwalkable }),
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
