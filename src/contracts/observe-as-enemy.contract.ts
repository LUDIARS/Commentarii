// C-75 observeAsEnemy(world, enemy, mode, playerEntity): an enemy observes itself as self and
// never itself as an entity; in player mode every observed fighter is within its sight; the
// observation holds no masked value.

import type { SimEnemy, SimWorld } from '../adapters/sim/sim-world.ts';
import { findMaskedPointers } from '@ludiars/commentarii-sdk/replay';
import type { ObservationFrame, ObservationMode } from '@ludiars/commentarii-sdk/types';

export default {
  post: (observation: ObservationFrame, world: SimWorld, enemy: SimEnemy, mode: ObservationMode) => {
    if (observation.entities.some((entity) => entity.instance === enemy.instance)) return 'the enemy observes itself as an entity';
    if (findMaskedPointers(observation).length > 0) return 'an enemy observation holds a masked value';
    if (mode !== 'player') return true;
    const [x, , z] = observation.self.pos ?? [0, 0, 0];
    for (const entity of observation.entities) {
      const [ex = 0, , ez = 0] = entity.pos ?? [];
      if (Math.hypot(ex - x, ez - z) > world.config.sightRange + 0.01) return `instance ${entity.instance} is beyond sight`;
    }
    return true;
  },
};
