// guide render: when the bundle holds observations/verify/report.json (written by guide verify
// intent), the stage pages get its heatmap and band summary. Drawn from the player view, so
// masked intent items stay out. Without verify I/O or a report, render is unchanged.

import { join } from 'node:path';
import type { LoadResult } from '../../bundle/bundle.ts';
import { toPlayerView } from '../../bundle/player-view.ts';
import type { CliIo } from '../../cli/cli-io.ts';
import { renderStageExtras, type StageExtras } from '../report/render-stage-extras.ts';
import { REPORT_JSON_PATH, type VerifyReport } from '../report/verify-report.ts';

export async function readStageExtras(io: Pick<CliIo, 'verifyIo' | 'stderr'>, bundleDir: string, load: LoadResult): Promise<StageExtras | undefined> {
  const text = await io.verifyIo?.readText(join(bundleDir, REPORT_JSON_PATH));
  if (text === undefined) return undefined;
  let report: VerifyReport;
  try {
    report = JSON.parse(text) as VerifyReport;
  } catch (cause) {
    io.stderr(`guide render: ${REPORT_JSON_PATH} is not JSON (${(cause as Error).message}); stage pages are rendered without it\n`);
    return undefined;
  }
  return renderStageExtras(report, toPlayerView(load.bundle));
}
