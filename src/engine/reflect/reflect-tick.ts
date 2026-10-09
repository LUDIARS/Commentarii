// reflect (design 7.5): the last step of a tick. A pure function of the reflect state, the
// frame observed this tick and the plan that acted on it; returns the overlay lines concluded:
//   1. every open tactic episode takes the frame into account and has its expect judged on it
//      (check-expect, as the engine does): met -> success, broken -> mismatch + failure;
//   2. a tactic or variant that started acting opens an episode (tactic-outcome start);
//   3. entities the guide does not describe (unknown-entity, once per run and key);
//   4. damage dealt until a kill (value-estimate).
// reflectEnd closes what is still open when the run ends (unresolved).

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import type { RunningPlan } from '../engine-state.ts';
import { checkExpect } from '../expect/check-expect.ts';
import { EMPTY_DAMAGE_TALLY, tallyDamage, type DamageTally } from './damage-tally.ts';
import { mismatchLine, outcomeLine, startLine } from './episode-lines.ts';
import type { OverlayLine } from './overlay-line.ts';
import type { ReflectWorld } from './reflect-world.ts';
import { advanceEpisode, openEpisode, type TacticEpisode } from './tactic-episode.ts';
import { unknownEntityLines } from './unknown-entities.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:349a976e */
import augurContract_8145f850 from '../../contracts/reflect-tick.contract.ts'; /* augur-inject:contract-predicate:4db3e608 */

export interface ReflectState {
  /** Candidate ID -> its episode still waiting for a verdict. */
  readonly episodes: ReadonlyMap<string, TacticEpisode>;
  /** Candidate ID -> startedT of its last judged episode (a plan that keeps acting after its verdict is not reopened). */
  readonly judged: ReadonlyMap<string, number>;
  readonly reported: ReadonlySet<string>;
  readonly damage: DamageTally;
  /** The last frame reflected (reflectEnd closes open episodes on it). */
  readonly last?: ObservationFrame;
}

export const INITIAL_REFLECT_STATE: ReflectState = { episodes: new Map(), judged: new Map(), reported: new Set(), damage: EMPTY_DAMAGE_TALLY };

export interface ReflectInput {
  readonly world: ReflectWorld;
  readonly observation: ObservationFrame;
  /** TickOutcome.acted: the plan that acted on this observation, if any. */
  readonly acted?: RunningPlan;
}

export interface ReflectResult {
  readonly state: ReflectState;
  readonly lines: readonly OverlayLine[];
}

function judgeEpisodes(state: ReflectState, frame: ObservationFrame, lines: OverlayLine[]): Pick<ReflectState, 'episodes' | 'judged'> {
  const episodes = new Map<string, TacticEpisode>();
  const judged = new Map(state.judged);
  for (const [id, episode] of state.episodes) {
    const current = advanceEpisode(episode, frame);
    const status = checkExpect(current.expect, current.bindings, current.startedT, frame);
    if (status === 'pending') {
      episodes.set(id, current);
      continue;
    }
    if (status === 'broken') lines.push(mismatchLine(current, frame));
    lines.push(outcomeLine(current, frame, status === 'met' ? 'success' : 'failure'));
    judged.set(id, current.startedT);
  }
  return { episodes, judged };
}

function startEpisode(
  episodes: Map<string, TacticEpisode>,
  judged: ReadonlyMap<string, number>,
  acted: RunningPlan | undefined,
  frame: ObservationFrame,
  lines: OverlayLine[],
): void {
  if (acted === undefined) return;
  const id = acted.candidate.id;
  const open = episodes.get(id);
  if (open?.startedT === acted.startedT || judged.get(id) === acted.startedT) return;
  const episode = openEpisode(acted, frame);
  if (episode === undefined) return;
  // A new start of the same candidate while the previous run is unjudged ends that run.
  if (open !== undefined) lines.push(outcomeLine(open, frame, 'unresolved'));
  episodes.set(id, episode);
  lines.push(startLine(episode, frame));
}

export function reflectTick(state: ReflectState, input: ReflectInput): ReflectResult {
  const frame = input.observation;
  const lines: OverlayLine[] = [];
  const { episodes, judged } = judgeEpisodes(state, frame, lines);
  const open = new Map(episodes);
  startEpisode(open, judged, input.acted, frame, lines);
  const unknown = unknownEntityLines(frame, input.world, state.reported);
  const damage = tallyDamage(state.damage, frame);
  lines.push(...unknown.lines, ...damage.lines);
  return { state: { episodes: open, judged, reported: unknown.reported, damage: damage.tally, last: frame }, lines };
}
// @ts-expect-error augur-inject
reflectTick = contract(reflectTick, { ...augurContract_8145f850, contractId: 'C-30', mode: 'observe', sample: 1, where: 'src/engine/reflect/reflect-tick.ts:81', rule: 'contract-wrap', id: '8145f850' }); /* augur-inject:contract-wrap:8145f850 */

/** Lines closing every episode still open at the end of the run (on the last frame reflected). */
export function reflectEnd(state: ReflectState): OverlayLine[] {
  const last = state.last;
  if (last === undefined) return [];
  return [...state.episodes.values()].map((episode) => outcomeLine(episode, last, 'unresolved'));
}
