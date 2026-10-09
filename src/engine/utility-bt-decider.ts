// The stage 3 engine as a replay Decider (`utility-bt`): Utility picks the aim, BT carries it
// out (design 7.4). Owns the per-run state and the seeded PRNG; everything else is the pure
// decideTick. Two draws per tick, always, so the random sequence (and with it every later
// decision) depends only on the seed and the number of ticks: the same seed and observation
// sequence give the same decisions (what `guide replay play` checks).

import type { Bundle } from '../bundle/bundle.ts';
import type { Decider } from '../replay/decider.ts';
import type { ObservationMode } from '../replay/observation-frame.ts';
import { decideTick, type TickOutcome } from './decide-tick.ts';
import { INITIAL_ENGINE_STATE, type EngineState } from './engine-state.ts';
import type { Persona } from './persona/persona.ts';
import { createRng, deriveSeed } from './rng.ts';
import { buildEngineWorld } from './world/build-engine-world.ts';
import type { EngineWorld } from './world/engine-world.ts';

export const UTILITY_BT_DECIDER_ID = 'utility-bt';

export interface EngineSetup {
  readonly bundle: Bundle;
  readonly persona: Persona;
}

export interface UtilityBtDecider extends Decider {
  /** The full outcome of the last decide() (for bench statistics and tests). */
  readonly lastOutcome: TickOutcome | undefined;
}

export function createUtilityBtDecider(setup: EngineSetup, seed: number | string): UtilityBtDecider {
  const rng = createRng(deriveSeed(seed, UTILITY_BT_DECIDER_ID));
  const worlds = new Map<ObservationMode, EngineWorld>();
  const worldFor = (mode: ObservationMode): EngineWorld => {
    let world = worlds.get(mode);
    if (world === undefined) {
      world = buildEngineWorld(setup.bundle, mode);
      worlds.set(mode, world);
    }
    return world;
  };
  let state: EngineState = INITIAL_ENGINE_STATE;
  let lastOutcome: TickOutcome | undefined;
  return {
    id: UTILITY_BT_DECIDER_ID,
    get lastOutcome() {
      return lastOutcome;
    },
    decide(observation) {
      const rolls = { explore: rng.next(), misplay: rng.next() };
      const outcome = decideTick({ world: worldFor(observation.mode), persona: setup.persona, state, observation, rolls });
      state = outcome.state;
      lastOutcome = outcome;
      return { decision: outcome.decision, action: outcome.action };
    },
  };
}
