// C-8 parseReplay(text, schema): a run comes back only without issues, framed by header and
// footer, with strictly increasing ticks, and a player run holds no masked value anywhere.

import type { ReplayLoad } from '../replay/parse-replay.ts';

function containsMasked(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsMasked);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.knowledge === 'masked') return true;
  return Object.values(record).some(containsMasked);
}

export default {
  post: (result: ReplayLoad) => {
    const { run, issues } = result;
    if (run === undefined) return issues.length > 0 || 'no run and no issue';
    if (issues.length > 0) return 'run returned together with issues';
    if (run.header.type !== 'header' || run.footer.type !== 'footer') return 'run is not framed by header and footer';
    for (let index = 1; index < run.ticks.length; index += 1) {
      const previous = run.ticks[index - 1];
      const current = run.ticks[index];
      if (previous === undefined || current === undefined || current.tick <= previous.tick) return `tick does not increase at index ${index}`;
    }
    if (run.header.mode === 'player' && containsMasked(run)) return 'player run contains a masked value';
    return true;
  },
};
