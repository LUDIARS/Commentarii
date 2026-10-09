// ReplayRun -> replay/<run-id>.jsonl text (spec/feature/replay.md 1): header, ticks, footer, one
// JSON object per LF-terminated line.

import type { ReplayRun } from '../../replay/replay-record.ts';

export function serializeReplayRun(run: ReplayRun): string {
  return [run.header, ...run.ticks, run.footer].map((line) => `${JSON.stringify(line)}\n`).join('');
}
