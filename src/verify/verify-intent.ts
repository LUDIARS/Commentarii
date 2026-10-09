// guide verify intent, the computation (no I/O): replays -> per stage the intent classes
// (design 8.3), the feasibility bands and good-play axes (8.5), the heatmap panels (14.H) and the
// merged divergence store. Omniscient runs are only listed (principle 2). Draft intents (LLM
// drafts) are not verified against.

import type { Bundle, LoadResult, StageFiles } from '../bundle/bundle.ts';
import { toPlayerView } from '../bundle/player-view.ts';
import type { Intent } from '../domain/documents.ts';
import { buildEngineWorld } from '../engine/world/build-engine-world.ts';
import type { ReplayRun } from '../replay/replay-record.ts';
import { buildFeasibility } from './feasibility/build-feasibility.ts';
import { feasibilityPath, type FeasibilityDocument } from './feasibility/feasibility-document.ts';
import { thresholdsOf } from './feasibility/thresholds.ts';
import { classifyIntents } from './intent/classify-intents.ts';
import { mergeDivergences, type DivergenceStore } from './intent/divergence-store.ts';
import { buildStageReport } from './report/build-stage-report.ts';
import { GOOD_PLAY_SVG, type StageReport, type VerifyReport } from './report/verify-report.ts';
import { selectRuns } from './runs/select-runs.ts';
import { traceRun } from './runs/stage-trace.ts';
import { VerifyError } from './verify-error.ts';

export interface VerifyInput {
  readonly load: LoadResult;
  readonly runs: readonly ReplayRun[];
  /** Run files that did not load as replays (reported only). */
  readonly unreadable: readonly string[];
  readonly persona?: string;
  /** observations/divergences.json as it was, if any. */
  readonly store?: DivergenceStore;
}

export interface VerifyOutput {
  readonly report: VerifyReport;
  readonly store: DivergenceStore;
  /** feasibility/<stage-slug>.json path -> document. */
  readonly feasibility: ReadonlyMap<string, FeasibilityDocument>;
}

function stageIdOf(stage: StageFiles): string | undefined {
  return stage.stage?.doc.id ?? stage.map?.doc.stage;
}

function playerNodes(view: Bundle, stageId: string): Set<string> {
  const stage = view.stages.find((candidate) => stageIdOf(candidate) === stageId);
  return new Set((stage?.map?.doc.nodes ?? []).map((node) => node.id));
}

export function verifyIntent(input: VerifyInput): VerifyOutput {
  const { bundle } = input.load;
  const gameId = bundle.manifest?.doc.game_id;
  if (gameId === undefined) throw new VerifyError('the bundle has no valid manifest.json (run guide validate)');
  const thresholds = thresholdsOf(bundle.manifest?.doc);
  const selection = selectRuns(input.runs, input.persona);
  const traces = selection.counted.flatMap((entry) => traceRun(entry, thresholds.stall_after_sec));
  const world = buildEngineWorld(bundle, 'player');
  const view = toPlayerView(bundle);
  const intents: Intent[] = bundle.intents.map(({ doc }) => doc).filter((intent) => intent.draft !== true);
  const stages = bundle.stages.flatMap((stage) => {
    const id = stageIdOf(stage);
    return id === undefined ? [] : [{ id, slug: stage.slug }];
  });
  const computed = stages.map(({ id, slug }) => {
    const intent = intents.find((candidate) => candidate.stage === id);
    const own = traces.filter((trace) => trace.stage === id);
    const verification = intent === undefined ? undefined : classifyIntents({ intent, traces: own, ignoredOmniscient: selection.ignoredOmniscient });
    const feasibility = buildFeasibility({
      stage: id,
      stageSlug: slug,
      ...(intent === undefined ? {} : { intent }),
      traces: own,
      ignoredOmniscient: selection.ignoredOmniscient,
      world,
      playerNodes: playerNodes(view, id),
      thresholds,
    });
    return { id, slug, intent, own, verification, feasibility };
  });
  const store = mergeDivergences(input.store, gameId, computed.flatMap((stage) => stage.verification?.divergences ?? []));
  const reports: StageReport[] = computed.map((stage) =>
    buildStageReport({
      bundle,
      stage: stage.id,
      slug: stage.slug,
      ...(stage.intent === undefined ? {} : { intent: stage.intent }),
      traces: stage.own,
      ...(stage.verification === undefined ? {} : { verification: stage.verification }),
      store,
      feasibility: stage.feasibility,
    }),
  );
  const report: VerifyReport = {
    game_id: gameId,
    ...(input.persona === undefined ? {} : { persona: input.persona }),
    runs: {
      counted: selection.counted.map((entry) => entry.run.header.run_id),
      ignored_omniscient: selection.ignoredOmniscient,
      ignored_efficiency: selection.ignoredEfficiency,
      filtered_out: selection.filteredOut,
      unreadable: [...input.unreadable],
    },
    good_play_svg: GOOD_PLAY_SVG,
    stages: reports,
  };
  return { report, store, feasibility: new Map(computed.map((stage) => [feasibilityPath(stage.slug), stage.feasibility])) };
}
