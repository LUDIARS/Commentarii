// Per-kind rules of the intent check (design 8.3, spec/feature/intent-verify.md 4): which stage
// traces an intended item is judged on, which of them reproduce it, and how the others diverge.

import type { DivergenceReason, IntendedItem } from '../../domain/documents.ts';
import type { StageTrace } from '../runs/stage-trace.ts';

export interface ItemJudgement {
  /** The traces the item is judged on. */
  readonly targets: readonly StageTrace[];
  /** Targets that reproduce the item. */
  readonly reproduced: readonly StageTrace[];
  /** Targets that diverge, with why. */
  readonly diverged: readonly { readonly trace: StageTrace; readonly reason: DivergenceReason }[];
}

/** `path` appears in `route` in order (not necessarily adjacent). */
export function followsPath(route: readonly string[], path: readonly string[]): boolean {
  let next = 0;
  for (const node of route) if (node === path[next]) next += 1;
  return next >= path.length;
}

function judge(targets: readonly StageTrace[], verdict: (trace: StageTrace) => DivergenceReason | 'reproduced' | undefined): ItemJudgement {
  const reproduced: StageTrace[] = [];
  const diverged: { trace: StageTrace; reason: DivergenceReason }[] = [];
  for (const trace of targets) {
    const result = verdict(trace);
    if (result === 'reproduced') reproduced.push(trace);
    else if (result !== undefined) diverged.push({ trace, reason: result });
  }
  return { targets, reproduced, diverged };
}

export function judgeItem(item: IntendedItem, traces: readonly StageTrace[]): ItemJudgement {
  switch (item.kind) {
    case 'route':
      return judge(traces, (trace) => {
        if (!trace.reached) return undefined;
        return followsPath(trace.route, item.path) ? 'reproduced' : 'alt-route';
      });
    case 'teach':
      return judge(
        traces.filter((trace) => trace.decisions),
        (trace) => {
          if (!trace.reached) return undefined;
          return trace.tactics.includes(item.tactic) ? 'reproduced' : 'teach-skipped';
        },
      );
    case 'time':
      return judge(traces, (trace) => {
        if (!trace.reached || trace.timeSec === undefined) return undefined;
        const [low, high] = item.range_sec;
        if (trace.timeSec < low) return 'shortcut';
        if (trace.timeSec > high) return 'over-time';
        return 'reproduced';
      });
    case 'forbid':
      return judge(traces, (trace) => (trace.route.includes(item.area) ? 'forbid-entered' : 'reproduced'));
  }
}
