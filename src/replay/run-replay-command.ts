// Runs `guide replay play|diff` and returns the exit code. A file that does not load is
// EXIT_INVALID, as is a play mismatch; a diff reports and exits OK either way.

import { EXIT_INVALID, EXIT_OK, type CliIo } from '../cli/cli-io.ts';
import { createDecider } from './decider-registry.ts';
import { diffReplays } from './diff-replays.ts';
import { formatPlayText } from './format-play-text.ts';
import { formatReplayDiffMarkdown } from './format-replay-diff-markdown.ts';
import { formatReplayIssues } from './format-replay-issues.ts';
import { playReplay } from './play-replay.ts';
import type { ReplayCommand } from './replay-command.ts';
import type { ReplayRun } from './replay-record.ts';

type ReplayIo = Pick<CliIo, 'stdout' | 'stderr' | 'openReplay'>;

async function load(path: string, io: ReplayIo): Promise<ReplayRun | undefined> {
  const loaded = await io.openReplay(path);
  if (loaded.run === undefined) io.stderr(formatReplayIssues(path, loaded.issues));
  return loaded.run;
}

function print(io: ReplayIo, json: boolean, report: unknown, text: string): void {
  io.stdout(json ? `${JSON.stringify(report, null, 2)}\n` : text);
}

export async function runReplayCommand(command: ReplayCommand, io: ReplayIo): Promise<number> {
  switch (command.name) {
    case 'replay-play': {
      const run = await load(command.runPath, io);
      if (run === undefined) return EXIT_INVALID;
      const options = command.until === undefined ? {} : { until: command.until };
      const report = playReplay(run, createDecider(command.decider, run), options);
      print(io, command.json, report, formatPlayText(report));
      return report.ok ? EXIT_OK : EXIT_INVALID;
    }
    case 'replay-diff': {
      const a = await load(command.aPath, io);
      const b = await load(command.bPath, io);
      if (a === undefined || b === undefined) return EXIT_INVALID;
      const diff = diffReplays(a, b, { limit: command.limit });
      print(io, command.json, diff, formatReplayDiffMarkdown(diff));
      return EXIT_OK;
    }
  }
}
