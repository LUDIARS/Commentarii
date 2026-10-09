// One run of a tactic (or of a variant) from the tick it started until its expect is judged:
// what it cost on the way (design 4.4 metrics). Measured on the frames as observed:
//   damage_taken  the decreases of the HP bar added up, in percent of the full bar (HP the
//                 tactic regained does not offset damage it took).
//   resource      per resource, the decreases added up (what was spent, not the net change).
//   nodes         the map nodes passed, in order of first visit (checked against `forbid`).

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import type { RunningPlan } from '../engine-state.ts';
import type { Bindings } from '../match/bindings.ts';
import { hpRatio, resourceAmounts } from '../observation/self-readings.ts';
import type { LineVariant } from './overlay-line.ts';

const PERCENT = 100;

export interface TacticEpisode {
  /** Engine candidate ID (the tactic ID, or variant:<variant tactic ID>). */
  readonly candidateId: string;
  /** Tactic ID measured: the tactic's, or the variant's own. */
  readonly tactic: string;
  readonly variant?: LineVariant;
  readonly expect: Readonly<Record<string, unknown>> | undefined;
  readonly bindings: Bindings;
  /** The plan's startedT (expect.within_sec counts from here). */
  readonly startedT: number;
  readonly startTick: number;
  readonly startT: number;
  readonly lastHp: number | undefined;
  readonly damage: number;
  readonly lastResources: Readonly<Record<string, number>>;
  readonly spent: Readonly<Record<string, number>>;
  readonly nodes: readonly string[];
}

function resourcesOf(frame: ObservationFrame): Record<string, number> {
  return Object.fromEntries(resourceAmounts(frame));
}

/** The episode a plan starts, or undefined when the plan is not a tactic or a variant. */
export function openEpisode(plan: RunningPlan, frame: ObservationFrame): TacticEpisode | undefined {
  const { candidate } = plan;
  const variant = candidate.variant;
  if (candidate.kind !== 'tactic' && variant === undefined) return undefined;
  const node = frame.stage.node;
  return {
    candidateId: candidate.id,
    tactic: variant === undefined ? candidate.id : variant.tactic,
    ...(variant === undefined ? {} : { variant: { of: variant.of, mutation: variant.mutation } }),
    expect: candidate.expect,
    bindings: candidate.bindings,
    startedT: plan.startedT,
    startTick: frame.tick,
    startT: frame.t,
    lastHp: hpRatio(frame),
    damage: 0,
    lastResources: resourcesOf(frame),
    spent: {},
    nodes: node === undefined ? [] : [node],
  };
}

function addSpent(episode: TacticEpisode, now: Readonly<Record<string, number>>): Record<string, number> {
  const spent = { ...episode.spent };
  for (const [name, amount] of Object.entries(now)) {
    const before = episode.lastResources[name];
    if (before !== undefined && amount < before) spent[name] = (spent[name] ?? 0) + (before - amount);
  }
  return spent;
}

/** The episode with one more frame taken into account. */
export function advanceEpisode(episode: TacticEpisode, frame: ObservationFrame): TacticEpisode {
  const hp = hpRatio(frame);
  const lost = hp !== undefined && episode.lastHp !== undefined && hp < episode.lastHp ? (episode.lastHp - hp) * PERCENT : 0;
  const resources = resourcesOf(frame);
  const node = frame.stage.node;
  return {
    ...episode,
    lastHp: hp ?? episode.lastHp,
    damage: episode.damage + lost,
    lastResources: { ...episode.lastResources, ...resources },
    spent: addSpent(episode, resources),
    nodes: node === undefined || episode.nodes.includes(node) ? episode.nodes : [...episode.nodes, node],
  };
}
