// Mechanisms the guide describes but no counted run used (design 8.3 "未使用の仕組み"): rules
// (referenced from the `because` of a tactic a run chose), skills (use_skill in a run's actions or
// in a chosen tactic's steps) and the tactics themselves.

import type { Bundle } from '../../bundle/bundle.ts';
import { parseRef } from '../../domain/id.ts';
import type { StageTrace } from '../runs/stage-trace.ts';
import { tacticOrigin } from '../runs/tactic-origin.ts';

export interface UnusedMechanisms {
  readonly rules: readonly string[];
  readonly skills: readonly string[];
  readonly tactics: readonly string[];
}

function baseOf(reference: string): string {
  return parseRef(reference)?.base ?? reference;
}

export function unusedMechanisms(bundle: Bundle, traces: readonly StageTrace[]): UnusedMechanisms {
  const usedTactics = new Set(traces.flatMap((trace) => trace.tactics.map(tacticOrigin)));
  const usedRules = new Set<string>();
  const usedSkills = new Set(traces.flatMap((trace) => trace.skills));
  for (const { doc } of bundle.tactics) {
    if (!usedTactics.has(doc.id)) continue;
    for (const reference of doc.because) if (reference.startsWith('rule:')) usedRules.add(baseOf(reference));
    for (const step of doc.do) if (typeof step.use_skill === 'string') usedSkills.add(step.use_skill);
  }
  const skills = bundle.entities.filter(({ doc }) => doc.id.startsWith('skill:')).map(({ doc }) => doc.id);
  return {
    rules: bundle.rules.map(({ doc }) => doc.id).filter((id) => !usedRules.has(id)).sort(),
    skills: skills.filter((id) => !usedSkills.has(id)).sort(),
    tactics: bundle.tactics.map(({ doc }) => doc.id).filter((id) => !usedTactics.has(id)).sort(),
  };
}
