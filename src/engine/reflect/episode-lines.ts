// Lines about a tactic episode (design 4.4 observation):
//   tactic-outcome  start, and at the end success / failure / unresolved with what it took
//                   (ticks, seconds, damage taken, resources spent, nodes passed).
//   mismatch        the expect that broke against what the frame showed (null where the bound
//                   instance was not visible).

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { isJsonObject } from '../../domain/value-node.ts';
import { findInstance } from '../observation/visible-entities.ts';
import { lineOf, type OverlayLine, type TacticOutcome } from './overlay-line.ts';
import type { TacticEpisode } from './tactic-episode.ts';

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundedRecord(record: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(Object.keys(record).sort().map((name) => [name, round3(record[name] ?? 0)]));
}

function episodeLine(episode: TacticEpisode, frame: ObservationFrame, kind: 'tactic-outcome' | 'mismatch'): OverlayLine {
  return { ...lineOf(frame, kind), tactic: episode.tactic, ...(episode.variant === undefined ? {} : { variant: episode.variant }) };
}

export function startLine(episode: TacticEpisode, frame: ObservationFrame): OverlayLine {
  return { ...episodeLine(episode, frame, 'tactic-outcome'), observed: { outcome: 'start' } };
}

export function outcomeLine(episode: TacticEpisode, frame: ObservationFrame, outcome: Exclude<TacticOutcome, 'start'>): OverlayLine {
  return {
    ...episodeLine(episode, frame, 'tactic-outcome'),
    observed: {
      outcome,
      ticks: frame.tick - episode.startTick,
      time_sec: round3(frame.t - episode.startT),
      damage_taken: round3(episode.damage),
      resource: roundedRecord(episode.spent),
      nodes: episode.nodes,
    },
  };
}

function observedStates(expected: unknown, episode: TacticEpisode, frame: ObservationFrame): Record<string, string | null> {
  if (!isJsonObject(expected)) return {};
  const states: Record<string, string | null> = {};
  for (const name of Object.keys(expected).sort()) {
    const instance = episode.bindings[name];
    const entity = instance === undefined ? undefined : findInstance(frame, instance);
    states[name] = entity?.state_guess ?? null;
  }
  return states;
}

export function mismatchLine(episode: TacticEpisode, frame: ObservationFrame): OverlayLine {
  const expect = episode.expect ?? {};
  return {
    ...episodeLine(episode, frame, 'mismatch'),
    expected: expect,
    observed: { entity_state: observedStates(expect.entity_state, episode, frame), elapsed_sec: round3(frame.t - episode.startedT) },
  };
}
