// A human run -> episodes: maximal stretches of ticks in the same situation, each with the
// action sequence the player used there, written as tactic steps (design 4.4 `do`). Waits are
// not steps, a repeated step counts once, an action on an instance becomes its binding
// ($enemy), and actions a tactic cannot express (a position, an entity out of the situation)
// are left out. Only the first MAX_STEPS steps are kept: a tactic is a short sequence.

import type { ActionOperand, ReplayAction } from '../../replay/replay-action.ts';
import type { ReplayRun } from '../../replay/replay-record.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { situationOf, type Situation } from './situation.ts';

export const MAX_STEPS = 4;

export type TacticStep = Readonly<Record<string, string | number>>;

export interface Episode {
  readonly runId: string;
  readonly player: string;
  readonly succeeded: boolean;
  readonly situation: Situation;
  /** The first observation of the episode (where `when` is evaluated). */
  readonly observation: ObservationFrame;
  readonly steps: readonly TacticStep[];
  readonly durationSec: number;
}

const VERBS = ['move_to', 'attack', 'use_item', 'use_skill', 'interact', 'custom'] as const;

function operandText(operand: ActionOperand | undefined, situation: Situation): string | undefined {
  if (typeof operand === 'string') return operand;
  if (typeof operand === 'number') return situation.bindings.get(operand);
  return undefined;
}

/** The step of one action, or undefined when a tactic cannot express it (or it is a wait). */
export function stepOf(action: ReplayAction, situation: Situation): TacticStep | undefined {
  const verb = VERBS.find((name) => action[name] !== undefined);
  if (verb === undefined) return undefined;
  const operand = operandText(action[verb], situation);
  if (operand === undefined) return undefined;
  if (action.target === undefined) return { [verb]: operand };
  const target = operandText(action.target, situation);
  return target === undefined ? undefined : { [verb]: operand, target };
}

/** Comparable text of a step, independent of key order. */
export function stepKey(step: TacticStep): string {
  return JSON.stringify(Object.entries(step).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function sameStep(a: TacticStep | undefined, b: TacticStep): boolean {
  return a !== undefined && stepKey(a) === stepKey(b);
}

interface OpenEpisode {
  situation: Situation;
  observation: ObservationFrame;
  steps: TacticStep[];
  startT: number;
  endT: number;
}

export function segmentEpisodes(run: ReplayRun): Episode[] {
  const player = typeof run.footer.summary.player === 'string' ? run.footer.summary.player : run.header.run_id;
  const close = (open: OpenEpisode): Episode => ({
    runId: run.header.run_id,
    player,
    succeeded: run.footer.result === 'success',
    situation: open.situation,
    observation: open.observation,
    steps: open.steps,
    durationSec: Math.max(open.endT - open.startT, 0),
  });
  const episodes: Episode[] = [];
  let open: OpenEpisode | undefined;
  for (const tick of run.ticks) {
    const situation = situationOf(tick.observation);
    if (open === undefined || open.situation.key !== situation.key) {
      if (open !== undefined) episodes.push(close(open));
      open = { situation, observation: tick.observation, steps: [], startT: tick.t, endT: tick.t };
    }
    open.endT = tick.t;
    // The same key names the same entities, so this tick's bindings give the same names (and
    // cover instances that appeared after the episode began).
    const step = stepOf(tick.action, situation);
    if (step !== undefined && open.steps.length < MAX_STEPS && !sameStep(open.steps.at(-1), step)) open.steps.push(step);
  }
  if (open !== undefined) episodes.push(close(open));
  return episodes.filter((episode) => episode.steps.length > 0);
}
