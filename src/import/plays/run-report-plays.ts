// guide report plays: human runs (observations/human/) next to player-mode autoplay runs
// (observations/runs/, replays recorded by guide run --record), per stage. Markdown by
// default, the PlaysReport with --json.

import { EXIT_OK } from '../../cli/cli-io.ts';
import { ImportError } from '../import-error.ts';
import { buildPlaysReport } from './build-plays-report.ts';
import { classifyPlayRuns } from './classify-play-runs.ts';
import { formatPlaysMarkdown } from './format-plays-markdown.ts';
import { AUTOPLAY_DIRECTORY, HUMAN_DIRECTORY } from './human-run-path.ts';
import type { ReportPlaysCommand } from './plays-command.ts';
import type { PlaysCliIo } from './run-import-plays.ts';

export async function runReportPlays(command: ReportPlaysCommand, io: Pick<PlaysCliIo, 'stdout' | 'openBundle' | 'playsIo'>): Promise<number> {
  const load = await io.openBundle(command.bundleDir);
  const gameId = load.bundle.manifest?.doc.game_id;
  if (gameId === undefined) throw new ImportError(`${command.bundleDir} has no valid manifest.json (run guide validate)`);
  const files = [
    ...(await io.playsIo.readRunFiles(command.bundleDir, HUMAN_DIRECTORY)),
    ...(await io.playsIo.readRunFiles(command.bundleDir, AUTOPLAY_DIRECTORY)),
  ];
  const report = buildPlaysReport(gameId, classifyPlayRuns(files, await io.playsIo.replaySchema()));
  io.stdout(command.json ? `${JSON.stringify(report, null, 2)}\n` : formatPlaysMarkdown(report));
  return EXIT_OK;
}
