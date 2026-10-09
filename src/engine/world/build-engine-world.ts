// Bundle -> EngineWorld for one mode. Player mode reads the bundle only through toPlayerView,
// and additionally drops masked tactics itself, so a masked tactic can never become a
// candidate even if a view bug let one through. Draft tactics are never used (design 4.3).

import type { Bundle, StageFiles } from '../../bundle/bundle.ts';
import { toPlayerView } from '../../bundle/player-view.ts';
import type { GuideMap, Intent, Tactic } from '../../domain/documents.ts';
import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservationMode } from '../../replay/observation-frame.ts';
import type { EngineWorld, MetricWeights, StageView } from './engine-world.ts';

const EQUAL_METRIC_WEIGHTS: MetricWeights = { time: 1 / 3, resource: 1 / 3, risk: 1 / 3 };

export function isUsableTactic(tactic: Tactic, mode: ObservationMode): boolean {
  if (tactic.draft === true) return false;
  if (tactic.superseded_by !== null) return false;
  return mode === 'omniscient' || tactic.knowledge !== 'masked';
}

function adjacencyOf(map: GuideMap | undefined): Map<string, string[]> {
  const table = new Map<string, Set<string>>((map?.nodes ?? []).map((node) => [node.id, new Set<string>()]));
  for (const edge of map?.edges ?? []) {
    table.get(edge.from)?.add(edge.to);
    if (edge.directed !== true) table.get(edge.to)?.add(edge.from);
  }
  return new Map([...table].map(([node, set]) => [node, [...set].sort()]));
}

function timeLimitOf(stage: StageFiles): number | undefined {
  const limit = stage.stage?.doc.time_limit?.value;
  return typeof limit === 'number' && limit > 0 ? limit : undefined;
}

/** The designer's upper time bound (intent time): only for the intent-assisted test. */
function intendedTimeLimitOf(intents: readonly Intent[]): number | undefined {
  for (const intent of intents) {
    for (const item of intent.intended) if (item.kind === 'time') return item.range_sec[1];
  }
  return undefined;
}

function stageView(stage: StageFiles, intents: readonly Intent[]): StageView | undefined {
  const id = stage.stage?.doc.id ?? stage.map?.doc.stage;
  if (id === undefined) return undefined;
  const own = intents.filter((intent) => intent.stage === id && intent.draft !== true);
  const map = stage.map?.doc;
  const timeLimit = timeLimitOf(stage);
  const intendedTimeLimit = intendedTimeLimitOf(own);
  return {
    id,
    nodes: (map?.nodes ?? []).map((node) => node.id),
    adjacency: adjacencyOf(map),
    resourceNodes: (map?.annotations ?? []).filter((note) => note.kind === 'resource').map((note) => note.target),
    intents: own.flatMap((intent) => intent.intended),
    ...(timeLimit === undefined ? {} : { timeLimit }),
    ...(intendedTimeLimit === undefined ? {} : { intendedTimeLimit }),
  };
}

function metricWeightsOf(bundle: Bundle): MetricWeights {
  const policy = bundle.manifest?.doc.learning?.policy;
  const rewrite = isJsonObject(policy) ? policy.rewrite : undefined;
  const weights = isJsonObject(rewrite) ? rewrite.metric_weights : undefined;
  if (!isJsonObject(weights)) return EQUAL_METRIC_WEIGHTS;
  const { time, resource, risk } = weights;
  if (typeof time !== 'number' || typeof resource !== 'number' || typeof risk !== 'number') return EQUAL_METRIC_WEIGHTS;
  const total = time + resource + risk;
  return total > 0 ? { time: time / total, resource: resource / total, risk: risk / total } : EQUAL_METRIC_WEIGHTS;
}

export function buildEngineWorld(bundle: Bundle, mode: ObservationMode): EngineWorld {
  const source = mode === 'player' ? toPlayerView(bundle) : bundle;
  const intents = source.intents.map(({ doc }) => doc);
  const stages = new Map<string, StageView>();
  for (const stage of source.stages) {
    const view = stageView(stage, intents);
    if (view !== undefined) stages.set(view.id, view);
  }
  return {
    mode,
    tactics: source.tactics.map(({ doc }) => doc).filter((tactic) => isUsableTactic(tactic, mode)),
    stages,
    metricWeights: metricWeightsOf(source),
  };
}
