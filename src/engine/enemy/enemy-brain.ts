// The engine as an enemy's brain (design 14.F, stage 6F): the same utility-bt decider, fed an
// observation from the enemy's own viewpoint (self = the enemy, entities = what it sees,
// including the player as an entity of the enemy's guide). Player mode by default: an enemy
// sees only what is in its sight; an all-knowing enemy must be asked for (mode omniscient).
// No enemy-specific code: the difference is the guide (actors' viewpoint) and the adapter.

import type { ReplayAction } from '../../replay/replay-action.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';
import { createUtilityBtDecider, type EngineSetup } from '../utility-bt-decider.ts';

export interface EnemyBrain {
  /** The chosen candidate of the last decision (for comparisons with a fixed behavior tree). */
  readonly lastChoice: string | undefined;
  decide(observation: ObservationFrame): ReplayAction;
}

export function createEnemyBrain(setup: EngineSetup, seed: number | string): EnemyBrain {
  const decider = createUtilityBtDecider(setup, seed);
  let lastChoice: string | undefined;
  return {
    get lastChoice() {
      return lastChoice;
    },
    decide(observation) {
      const outcome = decider.decide(observation);
      lastChoice = outcome.decision.find((entry) => entry.chosen)?.candidate;
      return outcome.action;
    },
  };
}
