// One stage's section of the verification report (spec/feature/intent-verify.md 5): intent
// classes, divergences ordered by past human verdicts, accepted ones and the learned tactics
// they make promotion candidates, reach per side, tactics used, time against the intent,
// unused mechanisms, heatmap panels and the feasibility summary.

import type { Bundle } from '../../bundle/bundle.ts';
import type { Intent } from '../../domain/documents.ts';
import { quantile } from '../../learn/stats/quantile.ts';
import type { Band, FeasibilityDocument } from '../feasibility/feasibility-document.ts';
import { feasibilityPath } from '../feasibility/feasibility-document.ts';
import { aggregateHeatmap } from '../heatmap/aggregate-heatmap.ts';
import type { IntentVerification } from '../intent/classify-intents.ts';
import { decisionIn, orderDivergences, type DivergenceStore } from '../intent/divergence-store.ts';
import { promotionCandidates } from '../intent/promotion-candidates.ts';
import { unusedMechanisms } from '../intent/unused-mechanisms.ts';
import type { StageTrace } from '../runs/stage-trace.ts';
import { heatmapFileName, type SideReach, type StageReport } from './verify-report.ts';

export interface StageReportInput {
  readonly bundle: Bundle;
  readonly stage: string;
  readonly slug: string;
  readonly intent?: Intent;
  readonly traces: readonly StageTrace[];
  readonly verification?: IntentVerification;
  readonly store: DivergenceStore;
  readonly feasibility: FeasibilityDocument;
}

const BANDS: readonly Band[] = ['feasible', 'extreme', 'illusory', 'impossible'];

function reachOf(traces: readonly StageTrace[]): SideReach {
  const reached = traces.filter((trace) => trace.reached).length;
  return { runs: traces.length, reached, reach_rate: traces.length === 0 ? null : Math.round((reached / traces.length) * 1e6) / 1e6 };
}

function timeOf(intent: Intent | undefined, traces: readonly StageTrace[]): StageReport['time'] {
  const medianSec = quantile(traces.flatMap((trace) => (trace.reached && trace.timeSec !== undefined ? [trace.timeSec] : [])), 0.5);
  const item = intent?.intended.find((entry) => entry.kind === 'time');
  const range = item?.kind === 'time' ? item.range_sec : undefined;
  const diff = medianSec === undefined || range === undefined ? undefined : medianSec < range[0] ? medianSec - range[0] : medianSec > range[1] ? medianSec - range[1] : 0;
  return {
    ...(medianSec === undefined ? {} : { median_sec: medianSec }),
    ...(range === undefined ? {} : { range_sec: range }),
    ...(diff === undefined ? {} : { diff_sec: Math.round(diff * 1e6) / 1e6 }),
  };
}

function tacticsUsed(traces: readonly StageTrace[]): { tactic: string; runs: number }[] {
  const counts = new Map<string, number>();
  for (const trace of traces) for (const tactic of new Set(trace.tactics)) counts.set(tactic, (counts.get(tactic) ?? 0) + 1);
  return [...counts].map(([tactic, runs]) => ({ tactic, runs })).sort((a, b) => b.runs - a.runs || (a.tactic < b.tactic ? -1 : 1));
}

export function buildStageReport(input: StageReportInput): StageReport {
  const { intent, traces, verification, feasibility } = input;
  const tactics = input.bundle.tactics.map(({ doc }) => doc);
  const divergences = orderDivergences(
    (verification?.divergences ?? []).map((divergence) => ({ ...divergence, decision: decisionIn(input.store, divergence.id) })),
    (entry) => entry.decision,
  );
  const accepted = verification?.accepted ?? [];
  const bands = Object.fromEntries(BANDS.map((band) => [band, feasibility.solutions.filter((solution) => solution.band === band).length])) as Record<Band, number>;
  return {
    stage: input.stage,
    slug: input.slug,
    design_stance: feasibility.design_stance,
    reach: { autoplay: reachOf(traces.filter((trace) => trace.side === 'autoplay')), human: reachOf(traces.filter((trace) => trace.side === 'human')) },
    intents: verification?.verdicts ?? [],
    divergences,
    accepted: accepted.map(({ divergence, allowed }) => ({ id: divergence.id, intent: divergence.intent, reason: divergence.reason, run: allowed.run, decided_by: allowed.decided_by })),
    promotions: accepted.flatMap(({ divergence }) => promotionCandidates(divergence.id, divergence.signature, tactics)),
    tactics_used: tacticsUsed(traces),
    time: timeOf(intent, traces),
    unused: unusedMechanisms(input.bundle, traces),
    heatmap: {
      svg: heatmapFileName(input.slug),
      panels: aggregateHeatmap(traces),
      routes: (intent?.intended ?? []).flatMap((item) => (item.kind === 'route' ? [item.path] : [])),
      forbid: (intent?.intended ?? []).flatMap((item) => (item.kind === 'forbid' ? [item.area] : [])),
    },
    feasibility: {
      path: feasibilityPath(input.slug),
      bands,
      illusory: feasibility.solutions.filter((solution) => solution.band === 'illusory' && solution.by_design === undefined).map((solution) => solution.id),
      axes: feasibility.axes,
    },
  };
}
