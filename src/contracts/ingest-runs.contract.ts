// C-31 ingestRuns(input): only player runs are learned from: no omniscient run is listed as a
// player run nor appears in any sample or estimate; every sample and estimate comes from a
// listed player run; a run already in the overlay is not ingested again; every rewrite
// candidate meets learning.policy.rewrite (min_runs, min_gain).

import type { IngestInput, IngestResult } from '../learn/ingest/ingest-runs.ts';

export default {
  post: (result: IngestResult, input: IngestInput) => {
    const { overlay, report } = result;
    const player = new Set(overlay.runs.player);
    const omniscient = new Set(input.runs.filter((run) => run.mode === 'omniscient').map((run) => run.run));
    for (const run of omniscient) if (player.has(run)) return `omniscient ${run} is listed as a player run`;
    const used = [
      ...overlay.tactics.flatMap((entry) => entry.samples.map((sample) => sample.run)),
      ...overlay.values.flatMap((entry) => entry.estimates.map((estimate) => estimate.run)),
    ];
    for (const run of used) {
      if (omniscient.has(run)) return `omniscient ${run} contributes a sample or estimate`;
      if (!player.has(run)) return `${run} contributes without being a listed player run`;
    }
    const before = new Set(input.overlay?.runs.player ?? []);
    for (const run of report.runs.ingested) if (before.has(run)) return `${run} was ingested twice`;
    const { min_runs: minRuns, min_gain: minGain } = input.policy.rewrite;
    for (const rewrite of overlay.rewrites) {
      if (rewrite.runs < minRuns) return `${rewrite.tactic.id} is a rewrite with ${rewrite.runs} < min_runs runs`;
      if (rewrite.gain < minGain) return `${rewrite.tactic.id} is a rewrite with gain ${rewrite.gain} < min_gain`;
    }
    return true;
  },
};
