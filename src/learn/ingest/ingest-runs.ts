// guide learn ingest (design 6, 8.1, 8.2): run observations -> the updated overlay and the list
// of differences. Pure: the caller reads the files and writes the overlay; the canonical bundle
// is only read. Counting rules (principle 2):
//   - only player runs are learned from; an omniscient run is listed as ignored and counted;
//   - a run already in the overlay is not counted twice (ingesting is idempotent per run ID).

import type { Bundle } from '../../bundle/bundle.ts';
import type { RunObservations } from '../observations/run-observations.ts';
import { emptyOverlay, type Overlay } from '../overlay/overlay.ts';
import { tuneWeights } from '../overlay/tune-weights.ts';
import type { LearningPolicy } from '../policy/learning-policy.ts';
import { digestRun } from './digest-run.ts';
import { findEfficientVariants, type VariantComparison } from './efficient-variants.ts';
import { findFailingTactics, type FailingTactic } from './failing-tactics.ts';
import { mergeDigest } from './merge-digest.ts';
import { findValueDrifts, type ValueDrift } from './value-drifts.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:59298917 */
import augurContract_9df72a24 from '../../contracts/ingest-runs.contract.ts'; /* augur-inject:contract-predicate:152e6d66 */

export interface IngestInput {
  readonly bundle: Bundle;
  readonly gameId: string;
  readonly policy: LearningPolicy;
  /** The current overlay, or undefined when none was written yet. */
  readonly overlay: Overlay | undefined;
  readonly runs: readonly RunObservations[];
}

export interface UnknownSummary {
  readonly key: string;
  readonly entity?: string;
  readonly draft: string;
  readonly runs: number;
  readonly sightings: number;
}

export interface IngestReport {
  readonly game_id: string;
  readonly runs: {
    readonly ingested: readonly string[];
    readonly already_ingested: readonly string[];
    /** Omniscient runs of this call: not learned from (principle 2). */
    readonly ignored_omniscient: readonly string[];
    readonly player_total: number;
    readonly omniscient_total: number;
  };
  readonly value_drifts: readonly ValueDrift[];
  readonly unknown_entities: readonly UnknownSummary[];
  readonly failing_tactics: readonly FailingTactic[];
  /** Every measured variant against its tactic; `meets` marks the rewrite candidates. */
  readonly variants: readonly VariantComparison[];
}

export interface IngestResult {
  readonly overlay: Overlay;
  readonly report: IngestReport;
}

function withRun(runs: readonly string[], run: string): string[] {
  return runs.includes(run) ? [...runs] : [...runs, run];
}

export function ingestRuns(input: IngestInput): IngestResult {
  let overlay = input.overlay ?? emptyOverlay(input.gameId);
  const ingested: string[] = [];
  const already: string[] = [];
  const ignored: string[] = [];
  for (const observations of input.runs) {
    const { run } = observations;
    if (observations.mode === 'omniscient') {
      ignored.push(run);
      overlay = { ...overlay, runs: { ...overlay.runs, ignored_omniscient: withRun(overlay.runs.ignored_omniscient, run) } };
      continue;
    }
    if (overlay.runs.player.includes(run)) {
      already.push(run);
      continue;
    }
    overlay = mergeDigest(overlay, digestRun(observations));
    ingested.push(run);
  }
  const variants = findEfficientVariants(input.bundle, overlay, input.policy);
  overlay = { ...overlay, rewrites: variants.rewrites, weights: tuneWeights(variants.compared, input.policy) };
  const report: IngestReport = {
    game_id: overlay.game_id,
    runs: {
      ingested,
      already_ingested: already,
      ignored_omniscient: ignored,
      player_total: overlay.runs.player.length,
      omniscient_total: overlay.runs.ignored_omniscient.length,
    },
    value_drifts: findValueDrifts(input.bundle, overlay),
    unknown_entities: overlay.unknown_entities.map((entry) => ({
      key: entry.key,
      ...(entry.entity === undefined ? {} : { entity: entry.entity }),
      draft: entry.draft.path,
      runs: entry.runs.length,
      sightings: entry.sightings,
    })),
    failing_tactics: findFailingTactics(overlay),
    variants: variants.compared,
  };
  return { overlay, report };
}
// @ts-expect-error augur-inject
ingestRuns = contract(ingestRuns, { ...augurContract_9df72a24, contractId: 'C-31', mode: 'observe', sample: 1, where: 'src/learn/ingest/ingest-runs.ts:61', rule: 'contract-wrap', id: '9df72a24' }); /* augur-inject:contract-wrap:9df72a24 */
