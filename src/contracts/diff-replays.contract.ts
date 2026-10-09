// C-11 diffReplays(a, b, options): every common tick before the first divergence agrees on
// action and chosen candidate; the divergence tick differs in action, choice or presence.

import { isDeepStrictEqual } from 'node:util';
import type { DiffOptions, ReplayDiff } from '../replay/diff-replays.ts';
import type { ReplayRun, ReplayTick } from '../replay/replay-record.ts';

function chosen(tick: ReplayTick): string | undefined {
  return tick.decision.find((entry) => entry.chosen)?.candidate;
}

function agrees(a: ReplayTick | undefined, b: ReplayTick | undefined): boolean {
  if (a === undefined || b === undefined) return false;
  return isDeepStrictEqual(a.action, b.action) && chosen(a) === chosen(b);
}

export default {
  post: (diff: ReplayDiff, a: ReplayRun, b: ReplayRun, options: DiffOptions = {}) => {
    const byTickA = new Map(a.ticks.map((tick) => [tick.tick, tick]));
    const byTickB = new Map(b.ticks.map((tick) => [tick.tick, tick]));
    const ticks = [...new Set([...byTickA.keys(), ...byTickB.keys()])].sort((x, y) => x - y);
    const first = ticks.find((tick) => !agrees(byTickA.get(tick), byTickB.get(tick)));
    const divergence = diff.first_divergence;
    if (first === undefined) {
      if (divergence !== null) return 'divergence reported for agreeing runs';
      if (diff.action_diff.count !== 0) return 'action differences reported for agreeing runs';
    } else if (divergence === null || divergence.tick !== first) {
      return `first divergence should be tick ${first}`;
    }
    const { count, shown, limit } = diff.action_diff;
    if (options.limit !== undefined && limit !== options.limit) return 'limit not applied';
    return (shown.length <= limit && shown.length <= count) || 'more differences shown than allowed';
  },
};
