// The intent verification of a coverage bench, reduced to what the gate compares: how many
// intended items fell in each class, and which undesirable divergences are open (not accepted).

import type { BenchDivergences } from '../bench/bench-result.ts';
import type { VerifyReport } from '../verify/report/verify-report.ts';

export function benchDivergences(report: VerifyReport): BenchDivergences {
  const classes: Record<string, number> = {};
  for (const stage of report.stages) for (const verdict of stage.intents) classes[verdict.classification] = (classes[verdict.classification] ?? 0) + 1;
  const undesirable = report.stages.flatMap((stage) => stage.divergences.filter((divergence) => divergence.kind === 'undesirable' && divergence.decision !== 'allow').map((divergence) => divergence.id));
  return { classes: Object.fromEntries(Object.entries(classes).sort(([a], [b]) => (a < b ? -1 : 1))), undesirable: [...new Set(undesirable)].sort() };
}
