// Compares two runs tick by tick (aligned on tick number): the first tick where the judgement
// branched (different action, different chosen candidate, or the tick exists in one run only),
// the utilities of every candidate at that tick, and the action differences from there on.
// Used to compare a run before and after a tactic rewrite (design 14.A).

import { isDeepStrictEqual } from 'node:util';
import type { ReplayAction } from './replay-action.ts';
import { chosenCandidate, type ReplayRun, type ReplayTick } from './replay-record.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:afeed0fa */
import augurContract_85cfa426 from '../contracts/diff-replays.contract.ts'; /* augur-inject:contract-predicate:3ce2d84f */

export const DEFAULT_DIFF_LIMIT = 10;

export interface DiffOptions {
  /** How many action differences to list (the count is always complete). */
  readonly limit?: number;
}

export type DivergenceReason = 'action' | 'decision' | 'missing-tick';

export interface UtilityDelta {
  readonly candidate: string;
  readonly a: number | null;
  readonly b: number | null;
  /** b - a, when both runs weighed the candidate. */
  readonly delta: number | null;
  readonly chosen_a: boolean;
  readonly chosen_b: boolean;
}

export interface Divergence {
  readonly tick: number;
  readonly reasons: readonly DivergenceReason[];
  readonly a_action: ReplayAction | null;
  readonly b_action: ReplayAction | null;
  readonly a_chosen: string | null;
  readonly b_chosen: string | null;
  readonly utilities: readonly UtilityDelta[];
}

export interface ActionDifference {
  readonly tick: number;
  readonly a: ReplayAction | null;
  readonly b: ReplayAction | null;
}

export interface RunSide {
  readonly run_id: string;
  readonly ticks: number;
}

export interface ReplayDiff {
  readonly a: RunSide;
  readonly b: RunSide;
  readonly first_divergence: Divergence | null;
  /** Ticks from the first divergence on whose actions differ (or exist in one run only). */
  readonly action_diff: { readonly count: number; readonly limit: number; readonly shown: readonly ActionDifference[] };
}

function divergenceReasons(a: ReplayTick | undefined, b: ReplayTick | undefined): DivergenceReason[] {
  if (a === undefined || b === undefined) return ['missing-tick'];
  const reasons: DivergenceReason[] = [];
  if (!isDeepStrictEqual(a.action, b.action)) reasons.push('action');
  if (chosenCandidate(a) !== chosenCandidate(b)) reasons.push('decision');
  return reasons;
}

function utilityDeltas(a: ReplayTick | undefined, b: ReplayTick | undefined): UtilityDelta[] {
  const fromA = new Map((a?.decision ?? []).map((entry) => [entry.candidate, entry]));
  const fromB = new Map((b?.decision ?? []).map((entry) => [entry.candidate, entry]));
  const candidates = [...new Set([...fromA.keys(), ...fromB.keys()])].sort();
  return candidates.map((candidate) => {
    const left = fromA.get(candidate);
    const right = fromB.get(candidate);
    return {
      candidate,
      a: left?.utility ?? null,
      b: right?.utility ?? null,
      delta: left !== undefined && right !== undefined ? right.utility - left.utility : null,
      chosen_a: left?.chosen ?? false,
      chosen_b: right?.chosen ?? false,
    };
  });
}

function side(run: ReplayRun): RunSide {
  return { run_id: run.header.run_id, ticks: run.ticks.length };
}

export function diffReplays(a: ReplayRun, b: ReplayRun, options: DiffOptions = {}): ReplayDiff {
  const limit = options.limit ?? DEFAULT_DIFF_LIMIT;
  const byTickA = new Map(a.ticks.map((tick) => [tick.tick, tick]));
  const byTickB = new Map(b.ticks.map((tick) => [tick.tick, tick]));
  const ticks = [...new Set([...byTickA.keys(), ...byTickB.keys()])].sort((x, y) => x - y);

  let divergence: Divergence | null = null;
  const differences: ActionDifference[] = [];
  for (const tick of ticks) {
    const left = byTickA.get(tick);
    const right = byTickB.get(tick);
    if (divergence === null) {
      const reasons = divergenceReasons(left, right);
      if (reasons.length === 0) continue;
      divergence = {
        tick,
        reasons,
        a_action: left?.action ?? null,
        b_action: right?.action ?? null,
        a_chosen: left === undefined ? null : (chosenCandidate(left) ?? null),
        b_chosen: right === undefined ? null : (chosenCandidate(right) ?? null),
        utilities: utilityDeltas(left, right),
      };
    }
    if (left === undefined || right === undefined || !isDeepStrictEqual(left.action, right.action)) {
      differences.push({ tick, a: left?.action ?? null, b: right?.action ?? null });
    }
  }
  return {
    a: side(a),
    b: side(b),
    first_divergence: divergence,
    action_diff: { count: differences.length, limit, shown: differences.slice(0, limit) },
  };
}
// @ts-expect-error augur-inject
diffReplays = contract(diffReplays, { ...augurContract_85cfa426, contractId: 'C-11', mode: 'observe', sample: 1, where: 'src/replay/diff-replays.ts:88', rule: 'contract-wrap', id: '85cfa426' }); /* augur-inject:contract-wrap:85cfa426 */
