// Test helpers for intent verification (stage 5): the hand-written coverage replays of
// tests/fixtures/verify, their stage traces, and a temp copy of the sample bundle.

import { cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { replaySchema } from '../../src/adapters/fs/replay-open-file.ts';
import { parseReplay } from '../../src/replay/parse-replay.ts';
import type { ReplayRun } from '../../src/replay/replay-record.ts';
import { selectRuns } from '../../src/verify/runs/select-runs.ts';
import { traceRun, type StageTrace } from '../../src/verify/runs/stage-trace.ts';
import { REPO_ROOT, SAMPLE_DIR } from './bundles.ts';

export const VERIFY_FIXTURES = join(REPO_ROOT, 'tests', 'fixtures', 'verify');
export const MAIN_RUNS = join(VERIFY_FIXTURES, 'runs');
export const SEALED_RUNS = join(VERIFY_FIXTURES, 'runs-sealed');
export const STAGE = 'stage:bestia:dome-arena';
export const KITE = 'tactic:bestia:kite-wire-spider';
export const ROUTE_INTENT = 'intent:bestia:dome-arena:fight-center';
export const TEACH_INTENT = 'intent:bestia:dome-arena:learn-kite';
export const TIME_INTENT = 'intent:bestia:dome-arena:time';
export const FORBID_INTENT = 'intent:bestia:dome-arena:no-ring-out';

/** Every replay under a fixture directory (files that are not replays are skipped). */
export async function readFixtureRuns(directory: string): Promise<ReplayRun[]> {
  const schema = await replaySchema();
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const paths = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl')).map((entry) => join(entry.parentPath, entry.name)).sort();
  const runs: ReplayRun[] = [];
  for (const path of paths) {
    const run = parseReplay(await readFile(path, 'utf8'), schema).run;
    if (run !== undefined) runs.push(run);
  }
  return runs;
}

export async function fixtureTraces(directory: string, stallAfterSec = 10): Promise<{ traces: StageTrace[]; ignoredOmniscient: readonly string[] }> {
  const selection = selectRuns(await readFixtureRuns(directory));
  return { traces: selection.counted.flatMap((entry) => traceRun(entry, stallAfterSec)), ignoredOmniscient: selection.ignoredOmniscient };
}

/** A temp directory holding a plain copy of the sample bundle. */
export async function withSampleCopy(body: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'cm-verify-'));
  try {
    await cp(SAMPLE_DIR, directory, { recursive: true });
    await body(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** A minimal stage trace for unit tests. */
export function trace(overrides: Partial<StageTrace> & Pick<StageTrace, 'run'>): StageTrace {
  return {
    persona: 'novice',
    side: 'autoplay',
    stage: STAGE,
    reached: true,
    timeSec: 90,
    route: ['node:mid-ring', 'node:center'],
    tactics: [],
    decisions: true,
    nodes: {},
    moves: [],
    stallSec: 0,
    skills: [],
    frames: [],
    ...overrides,
  };
}
