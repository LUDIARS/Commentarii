// C-70 selectRuns(runs, persona): no omniscient run and no intent-assisted engine run is ever
// counted (the designer's intent handed to the decider is an answer-key test, not a persona's
// ability); every run lands in exactly one list.

import type { ReplayRun } from '../replay/replay-record.ts';
import type { RunSelection } from '../verify/runs/select-runs.ts';

export default {
  post: (selection: RunSelection, runs: readonly ReplayRun[]) => {
    for (const entry of selection.counted) {
      if (entry.run.header.mode === 'omniscient') return `omniscient ${entry.run.header.run_id} is counted`;
      if (entry.run.header.decision_mode === 'intent-assisted') return `intent-assisted ${entry.run.header.run_id} is counted`;
    }
    const listed = selection.counted.length + selection.ignoredOmniscient.length + selection.ignoredEfficiency.length + selection.ignoredIntentAssisted.length + selection.filteredOut.length;
    return listed === runs.length || `${runs.length} runs, ${listed} listed`;
  },
};
