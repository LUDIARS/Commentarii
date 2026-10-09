// All candidates of one tick: tactics whose `when` holds + generic actions + exploration, plus
// the plan already running (kept even when its `when` no longer holds: a started tactic runs
// to its end unless its expectation breaks or something clearly better comes up). Sorted by
// ID so the decision log and tie-breaking do not depend on generation order.

import type { ObservationFrame } from '../../replay/observation-frame.ts';
import type { Persona } from '../persona/persona.ts';
import type { EngineWorld } from '../world/engine-world.ts';
import type { Candidate } from './candidate.ts';
import { exploreCandidates } from './explore-candidates.ts';
import { genericCandidates } from './generic-candidates.ts';
import type { RunMemory } from './run-memory.ts';
import { tacticCandidates } from './tactic-candidates.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:49ae8bde */
import augurContract_be9fda07 from '../../contracts/generate-candidates.contract.ts'; /* augur-inject:contract-predicate:a66c9057 */

export interface GenerationInput {
  readonly world: EngineWorld;
  readonly persona: Persona;
  readonly observation: ObservationFrame;
  readonly memory: RunMemory;
  /** The candidate whose tree is still running, if any. */
  readonly running?: Candidate;
}

export function generateCandidates(input: GenerationInput): Candidate[] {
  const { world, persona, observation, memory, running } = input;
  const stage = world.stages.get(observation.stage.id);
  const tactics = tacticCandidates(world, persona, observation, memory);
  const fresh = [...tactics, ...genericCandidates(observation, stage, memory), ...exploreCandidates(observation, stage, memory, tactics)];
  const byId = new Map<string, Candidate>();
  for (const candidate of fresh) if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  if (running !== undefined) byId.set(running.id, { ...running, continuing: true });
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
// @ts-expect-error augur-inject
generateCandidates = contract(generateCandidates, { ...augurContract_be9fda07, contractId: 'C-18', mode: 'observe', sample: 1, where: 'src/engine/candidates/generate-candidates.ts:24', rule: 'contract-wrap', id: 'be9fda07' }); /* augur-inject:contract-wrap:be9fda07 */
