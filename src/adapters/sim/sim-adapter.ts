// The simulator as a GameAdapter (`--adapter sim`): a small deterministic game built from the
// bundle alone (map, entities, state machines, rules), for tests and benches. Same seed, same
// actions -> same observations.

import type { Bundle } from '../../bundle/bundle.ts';
import type { GameAdapter } from '../../adapter/game-adapter.ts';
import { parseRef } from '../../domain/id.ts';
import type { ObservationMode, ObservationPurpose } from '../../replay/observation-frame.ts';
import { createSimWorld } from './create-sim-world.ts';
import { DEFAULT_SIM_CONFIG, type SimConfig } from './sim-config.ts';
import { observeSim } from './sim-observation.ts';
import type { SimOutcome } from './sim-world.ts';
import { stepSim } from './step-sim.ts';

export const SIM_ADAPTER_ID = 'commentarii-sim';

export interface SimOptions {
  readonly bundle: Bundle;
  readonly mode: ObservationMode;
  readonly purpose: ObservationPurpose;
  /** Seed of the sim's own PRNG (derive it from the run seed). */
  readonly seed: number;
  readonly config?: SimConfig;
  readonly stageId?: string;
}

export interface SimStats {
  readonly outcome: SimOutcome;
  readonly ticks: number;
  readonly time_sec: number;
  readonly damage_taken: number;
  readonly damage_dealt: number;
  readonly enemies_left: number;
}

export interface SimAdapter extends GameAdapter {
  stats(): SimStats;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createSimAdapter(options: SimOptions): SimAdapter {
  const world = createSimWorld({ bundle: options.bundle, seed: options.seed, config: options.config ?? DEFAULT_SIM_CONFIG, ...(options.stageId ? { stageId: options.stageId } : {}) });
  const gameId = options.bundle.manifest?.doc.game_id;
  if (gameId === undefined) throw new Error('the sim needs a bundle with a manifest (game_id)');
  const stats = (): SimStats => ({
    outcome: world.outcome,
    ticks: world.tick,
    time_sec: round(world.t),
    damage_taken: round(world.damageTaken),
    damage_dealt: round(world.damageDealt),
    enemies_left: world.enemies.filter((enemy) => enemy.alive).length,
  });
  return {
    async hello() {
      return { game_id: gameId, adapter_id: SIM_ADAPTER_ID, mode: options.mode };
    },
    async observe() {
      if (world.outcome !== 'running') return { type: 'end', end: { result: world.outcome, summary: { ...stats() } } };
      return { type: 'observation', frame: observeSim(world, options.mode, options.purpose) };
    },
    async act(action) {
      stepSim(world, action);
    },
    identify(gameEntity) {
      // The sim's own entity keys are the bundle slugs (or the IDs themselves).
      return options.bundle.entities.map(({ doc }) => doc.id).find((id) => id === gameEntity || parseRef(id)?.slug === gameEntity);
    },
    async close() {
      // Nothing to release: the sim lives in memory.
    },
    stats,
  };
}
