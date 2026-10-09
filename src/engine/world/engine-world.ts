// What the engine knows from the guide for one run: the tactics it may use and, per stage, the
// map graph, the designer's intent and the time limit. Built once per mode from the bundle
// (player mode from the masked-free player view, principle 2).

import type { IntendedItem, Tactic } from '../../domain/documents.ts';
import type { ObservationMode } from '../../replay/observation-frame.ts';

export interface MetricWeights {
  readonly time: number;
  readonly resource: number;
  readonly risk: number;
}

export interface StageView {
  readonly id: string;
  /** Map nodes in document order. */
  readonly nodes: readonly string[];
  /** node -> neighbouring nodes (sorted). */
  readonly adjacency: ReadonlyMap<string, readonly string[]>;
  /** Nodes annotated as resource spots. */
  readonly resourceNodes: readonly string[];
  readonly intents: readonly IntendedItem[];
  /** Seconds, from the stage time limit or else the intent's upper time bound. */
  readonly timeLimit?: number;
}

export interface EngineWorld {
  readonly mode: ObservationMode;
  /** Tactics the engine may ever propose in this mode (not draft, not superseded, not masked in player). */
  readonly tactics: readonly Tactic[];
  readonly stages: ReadonlyMap<string, StageView>;
  /** manifest learning.policy.rewrite.metric_weights, or equal weights. */
  readonly metricWeights: MetricWeights;
}
