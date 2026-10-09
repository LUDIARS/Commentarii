// Run files of a bundle's overlay -> human runs and autoplay runs. observations/human/ holds
// imported human plays (header source human); observations/runs/ may hold engine replays
// (guide run --record) next to stage 4's one-line overlay observations, which are not replays
// and are skipped, as is anything that does not load. Omniscient engine runs are counted and
// left out: they are never compared with players (principle 2).

import { parseReplay } from '../../replay/parse-replay.ts';
import type { ReplayRun } from '../../replay/replay-record.ts';
import type { ReplaySchema } from '../../replay/replay-schema.ts';
import { AUTOPLAY_DIRECTORY, HUMAN_DIRECTORY } from './human-run-path.ts';

export interface PlayRunFile {
  /** Bundle-relative path. */
  readonly path: string;
  readonly text: string;
}

export interface ClassifiedRuns {
  readonly human: readonly ReplayRun[];
  readonly autoplay: readonly ReplayRun[];
  readonly omniscientExcluded: number;
  readonly skipped: readonly string[];
}

export function classifyPlayRuns(files: readonly PlayRunFile[], schema: ReplaySchema): ClassifiedRuns {
  const human: ReplayRun[] = [];
  const autoplay: ReplayRun[] = [];
  const skipped: string[] = [];
  let omniscientExcluded = 0;
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    const run = parseReplay(file.text, schema).run;
    const isHumanFile = file.path.startsWith(`${HUMAN_DIRECTORY}/`);
    if (run === undefined || (!isHumanFile && !file.path.startsWith(`${AUTOPLAY_DIRECTORY}/`))) skipped.push(file.path);
    else if (isHumanFile) {
      if (run.header.source === 'human') human.push(run);
      else skipped.push(file.path);
    } else if (run.header.source === 'human') skipped.push(file.path);
    else if (run.header.mode === 'omniscient') omniscientExcluded += 1;
    else autoplay.push(run);
  }
  return { human, autoplay, omniscientExcluded, skipped };
}
