// Human text for `guide replay play`.

import { formatAction } from './format-action.ts';
import type { PlayReport } from './play-replay.ts';

export function formatPlayText(report: PlayReport): string {
  const scope = report.until === null ? 'all ticks' : `ticks <= ${report.until}`;
  const lines = [`replay play ${report.run_id} (decider=${report.decider}, ${scope})`];
  const mismatch = report.first_mismatch;
  if (mismatch === null) {
    lines.push(`result: OK (${report.ticks_checked} tick(s) matched)`);
  } else {
    lines.push(`result: MISMATCH at tick ${mismatch.tick} (${report.ticks_checked} tick(s) checked)`);
    lines.push(`  recorded: ${formatAction(mismatch.recorded)}`);
    lines.push(`  replayed: ${formatAction(mismatch.replayed)}`);
  }
  return `${lines.join('\n')}\n`;
}
