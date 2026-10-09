// One run -> what it did in each stage (spec/feature/intent-verify.md 3): got through or not,
// time, node route (stage 4D's stageVisits), the tactics it chose in order, per-node visits /
// dwell / deaths, node-to-node moves, stalling (time in one node beyond stall_after_sec, except the
// final stretch of a run that got through) and the skills it used. Frames are kept for the
// candidate generation check of the feasibility bands.

import { stageVisits } from '../../import/plays/stage-visits.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { chosenCandidate, type ReplayTick } from '../../replay/replay-record.ts';
import type { RunSide, VerifyRun } from './select-runs.ts';

export interface NodeTally {
  /** Times the run entered the node. */
  readonly visits: number;
  readonly dwellSec: number;
  readonly deaths: number;
}

export interface NodeMove {
  readonly from: string;
  readonly to: string;
  readonly count: number;
}

export interface StageTrace {
  readonly run: string;
  readonly persona: string;
  readonly side: RunSide;
  readonly stage: string;
  readonly reached: boolean;
  readonly timeSec?: number;
  readonly route: readonly string[];
  /** Chosen tactics (variants as <tactic>--<mutation>), repeats in a row folded. */
  readonly tactics: readonly string[];
  /** The run logged decisions in this stage (engine runs); teach is judged only then. */
  readonly decisions: boolean;
  readonly nodes: Readonly<Record<string, NodeTally>>;
  readonly moves: readonly NodeMove[];
  readonly stallSec: number;
  readonly skills: readonly string[];
  readonly frames: readonly ObservationFrame[];
}

const DEATH_EVENTS = new Set(['death', 'self-death']);

function tacticOf(candidate: string | undefined): string | undefined {
  if (candidate === undefined) return undefined;
  if (candidate.startsWith('tactic:')) return candidate;
  if (candidate.startsWith('variant:tactic:')) return candidate.slice('variant:'.length);
  return undefined;
}

function chosenTactics(ticks: readonly ReplayTick[]): string[] {
  const tactics: string[] = [];
  for (const tick of ticks) {
    const tactic = tacticOf(chosenCandidate(tick));
    if (tactic !== undefined && tactics.at(-1) !== tactic) tactics.push(tactic);
  }
  return tactics;
}

function hpOf(tick: ReplayTick): number | undefined {
  const value = tick.observation.self.hp?.value;
  return typeof value === 'number' ? value : undefined;
}

function died(tick: ReplayTick, previous: ReplayTick | undefined): boolean {
  if (tick.observation.events.some((event) => DEATH_EVENTS.has(event.kind))) return true;
  const hp = hpOf(tick);
  const before = previous === undefined ? undefined : hpOf(previous);
  return hp !== undefined && hp <= 0 && (before === undefined || before > 0);
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

interface Tallies {
  readonly nodes: Record<string, NodeTally>;
  readonly moves: NodeMove[];
  readonly stallSec: number;
}

/** The last stretch of a run that got through is where it finished the stage, not where it stalled. */
function tally(ticks: readonly ReplayTick[], stallAfterSec: number, reached: boolean): Tallies {
  const nodes: Record<string, { visits: number; dwellSec: number; deaths: number }> = {};
  const moves = new Map<string, { from: string; to: string; count: number }>();
  let stallSec = 0;
  let stretch = 0;
  let previousNode: string | undefined;
  ticks.forEach((tick, index) => {
    const node = tick.observation.stage.node;
    const next = ticks[index + 1];
    const dt = next === undefined ? 0 : Math.max(0, next.t - tick.t);
    if (node === undefined) return;
    const entry = (nodes[node] ??= { visits: 0, dwellSec: 0, deaths: 0 });
    if (node !== previousNode) {
      entry.visits += 1;
      if (previousNode !== undefined) {
        const key = JSON.stringify([previousNode, node]);
        const move = moves.get(key) ?? { from: previousNode, to: node, count: 0 };
        move.count += 1;
        moves.set(key, move);
      }
      stallSec += Math.max(0, stretch - stallAfterSec);
      stretch = 0;
    }
    entry.dwellSec = round(entry.dwellSec + dt);
    stretch += dt;
    if (died(tick, ticks[index - 1])) entry.deaths += 1;
    previousNode = node;
  });
  if (!reached) stallSec += Math.max(0, stretch - stallAfterSec);
  const sortedMoves = [...moves.values()].sort((a, b) => (a.from + a.to < b.from + b.to ? -1 : a.from + a.to > b.from + b.to ? 1 : 0));
  return { nodes, moves: sortedMoves, stallSec: round(stallSec) };
}

function skillsOf(ticks: readonly ReplayTick[]): string[] {
  const skills = new Set<string>();
  for (const tick of ticks) if (typeof tick.action.use_skill === 'string') skills.add(tick.action.use_skill);
  return [...skills].sort();
}

export function traceRun(entry: VerifyRun, stallAfterSec: number): StageTrace[] {
  const { run } = entry;
  return stageVisits(run).map((visit) => {
    const ticks = run.ticks.filter((tick) => tick.observation.stage.id === visit.stage);
    const { nodes, moves, stallSec } = tally(ticks, stallAfterSec, visit.reached);
    return {
      run: run.header.run_id,
      persona: entry.persona,
      side: entry.side,
      stage: visit.stage,
      reached: visit.reached,
      ...(visit.timeSec === undefined ? {} : { timeSec: visit.timeSec }),
      route: visit.route,
      tactics: chosenTactics(ticks),
      decisions: ticks.some((tick) => tick.decision.length > 0),
      nodes,
      moves,
      stallSec,
      skills: skillsOf(ticks),
      frames: ticks.map((tick) => tick.observation),
    };
  });
}
