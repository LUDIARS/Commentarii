// One engine tick (design 7.5: match -> decide -> act), as a pure function of the previous
// state, the observation and two random draws made by the caller:
//   1. perceive: the observation reaction_delay_ticks old (persona).
//   2. judge expectations (reflect): the running tactic's expect, and those of tactics that
//      already finished or were switched away from. A tactic is not proposed again until its
//      last run's expectation is judged; a broken one is dropped and held back for a while.
//   3. generate candidates, score them (Utility), and run the best one's tree (BT) for one
//      step. A tree that cannot act this tick (its target vanished, its goal already reached)
//      yields to the next best candidate; with none left the engine waits.
//   4. misplay: with the persona's misplay_rate the chosen action is fumbled into a wait.
// The decision log lists every candidate with its utility and marks the one that acted.

import type { ObservationFrame } from '../replay/observation-frame.ts';
import type { ReplayAction } from '../replay/replay-action.ts';
import type { DecisionEntry } from '../replay/replay-record.ts';
import { stepTree } from './bt/step-tree.ts';
import type { Candidate } from './candidates/candidate.ts';
import { generateCandidates } from './candidates/generate-candidates.ts';
import type { ExpectationWatch, RunMemory } from './candidates/run-memory.ts';
import { newPlan, type EngineState, type RunningPlan } from './engine-state.ts';
import { checkExpect } from './expect/check-expect.ts';
import type { Persona } from './persona/persona.ts';
import { scoreCandidate, type ScoredCandidate } from './utility/score-candidate.ts';
import type { EngineWorld } from './world/engine-world.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:1fe7fba0 */
import augurContract_ee77443c from '../contracts/decide-tick.contract.ts'; /* augur-inject:contract-predicate:dec43b32 */

/** Seconds a tactic whose expectation broke is not proposed again. */
export const HOLD_BACK_SEC = 5;

export const IDLE_ACTION: ReplayAction = { wait: 0 };

export interface TickRolls {
  /** Uniform [0, 1): exploration is active when below the persona's exploration_rate. */
  readonly explore: number;
  /** Uniform [0, 1): the action is fumbled when below the persona's misplay_rate. */
  readonly misplay: number;
}

export interface TickInput {
  readonly world: EngineWorld;
  readonly persona: Persona;
  readonly state: EngineState;
  readonly observation: ObservationFrame;
  readonly rolls: TickRolls;
}

export interface TickOutcome {
  readonly decision: readonly DecisionEntry[];
  readonly action: ReplayAction;
  readonly state: EngineState;
  /** The candidate that acted (undefined when the engine idled). */
  readonly chosen: string | undefined;
  /** Better-scored candidates whose tree could not act this tick. */
  readonly skipped: readonly string[];
  readonly exploring: boolean;
  readonly misplayed: boolean;
}

function perceive(state: EngineState, observation: ObservationFrame, persona: Persona): { recent: ObservationFrame[]; perceived: ObservationFrame } {
  const recent = [...state.recent, observation].slice(-(persona.reaction_delay_ticks + 1));
  return { recent, perceived: recent[0] ?? observation };
}

function remember(memory: RunMemory, perceived: ObservationFrame): RunMemory {
  const node = perceived.stage.node;
  if (node === undefined || memory.visited.has(node)) return memory;
  return { ...memory, visited: new Set([...memory.visited, node]) };
}

function holdBack(memory: RunMemory, candidateId: string, until: number): RunMemory {
  const heldBackUntil = new Map(memory.heldBackUntil);
  heldBackUntil.set(candidateId, until);
  return { ...memory, heldBackUntil };
}

/** Judges every watched expectation: met ones are dropped, broken ones held back. */
function judgeWatches(memory: RunMemory, perceived: ObservationFrame): RunMemory {
  if (memory.watching.size === 0) return memory;
  const watching = new Map<string, ExpectationWatch>();
  let current = memory;
  for (const [id, watch] of memory.watching) {
    const status = checkExpect(watch.expect, watch.bindings, watch.startedT, perceived);
    if (status === 'pending') watching.set(id, watch);
    else if (status === 'broken') current = holdBack(current, id, perceived.t + HOLD_BACK_SEC);
  }
  return { ...current, watching };
}

/** A plan that stops running (finished or switched away from) leaves its expectation to watch. */
function retire(memory: RunMemory, plan: RunningPlan): RunMemory {
  const expect = plan.candidate.expect;
  if (expect === undefined || plan.expectMet === true) return memory;
  const watching = new Map(memory.watching);
  watching.set(plan.candidate.id, { candidateId: plan.candidate.id, expect, bindings: plan.candidate.bindings, startedT: plan.startedT });
  return { ...memory, watching };
}

function markTried(memory: RunMemory, candidateId: string): RunMemory {
  return memory.tried.has(candidateId) ? memory : { ...memory, tried: new Set([...memory.tried, candidateId]) };
}

/** Best first; ties go to ID order (candidates arrive sorted by ID and the sort is stable). */
function rank(scored: readonly ScoredCandidate[]): ScoredCandidate[] {
  return [...scored].sort((a, b) => b.utility - a.utility);
}

function planFor(candidate: Candidate, running: RunningPlan | undefined, t: number): RunningPlan {
  return candidate.continuing === true && running !== undefined ? running : newPlan(candidate, t);
}

export function decideTick(input: TickInput): TickOutcome {
  const { world, persona, observation, rolls } = input;
  const { recent, perceived } = perceive(input.state, observation, persona);
  let memory = judgeWatches(remember(input.state.memory, perceived), perceived);
  let running = input.state.running;
  if (running !== undefined) {
    const status = running.expectMet === true ? 'met' : checkExpect(running.candidate.expect, running.candidate.bindings, running.startedT, perceived);
    if (status === 'broken') {
      memory = holdBack(memory, running.candidate.id, perceived.t + HOLD_BACK_SEC);
      running = undefined;
    } else if (status === 'met' && running.expectMet !== true) {
      running = { ...running, expectMet: true };
    }
  }

  const candidates = generateCandidates({ world, persona, observation: perceived, memory, ...(running ? { running: running.candidate } : {}) });
  const exploring = perceived.purpose === 'coverage' || rolls.explore < persona.exploration_rate;
  const context = { observation: perceived, world, stage: world.stages.get(perceived.stage.id), purpose: perceived.purpose, exploring };
  const scored = candidates.map((candidate) => scoreCandidate(candidate, persona, context));

  let chosen: string | undefined;
  let action: ReplayAction = IDLE_ACTION;
  let nextRunning: RunningPlan | undefined;
  const skipped: string[] = [];
  for (const { candidate } of rank(scored)) {
    const plan = planFor(candidate, running, perceived.t);
    const result = stepTree(plan.candidate.tree, plan.memory, { observation: perceived, bindings: plan.candidate.bindings });
    if (result.action === undefined) {
      skipped.push(candidate.id);
      continue;
    }
    chosen = candidate.id;
    action = result.action;
    memory = markTried(memory, candidate.id);
    const stepped: RunningPlan = { ...plan, candidate: { ...plan.candidate, continuing: false }, memory: result.memory };
    if (result.status === 'running') nextRunning = stepped;
    else memory = retire(memory, stepped);
    break;
  }
  if (running !== undefined && nextRunning?.candidate.id !== running.candidate.id && chosen !== running.candidate.id) memory = retire(memory, running);

  const misplayed = chosen !== undefined && rolls.misplay < persona.misplay_rate;
  const decision = scored.map(({ candidate, utility }) => ({ candidate: candidate.id, utility, chosen: candidate.id === chosen }));
  return {
    decision,
    action: misplayed ? IDLE_ACTION : action,
    state: { memory, recent, ...(nextRunning ? { running: nextRunning } : {}) },
    chosen,
    skipped,
    exploring,
    misplayed,
  };
}
// @ts-expect-error augur-inject
decideTick = contract(decideTick, { ...augurContract_ee77443c, contractId: 'C-19', mode: 'observe', sample: 1, where: 'src/engine/decide-tick.ts:110', rule: 'contract-wrap', id: 'ee77443c' }); /* augur-inject:contract-wrap:ee77443c */
