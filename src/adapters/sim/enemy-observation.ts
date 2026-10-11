// A simulated enemy's own observation (stage 6F): self is the enemy (position, its HP bar, its
// reach), entities are the fighters it sees - the player as the enemy guide's player entity
// (instance 0) and the other enemies - within its sight in player mode, all of them in
// omniscient mode. A "shot-at" event tells it was attacked this tick (what the fixed tree's dodge
// transition reads).

import type { ObservationFrame, ObservationMode, ObservedEntity, Vector3 } from '@ludiars/commentarii-sdk/types';
import type { Point } from './sim-layout.ts';
import { gap } from './sim-motion.ts';
import type { SimEnemy, SimWorld } from './sim-world.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:fa460e55 */
import augurContract_178e5275 from '../../contracts/observe-as-enemy.contract.ts'; /* augur-inject:contract-predicate:9fefbbe5 */

/** Instance number of the player in an enemy's observation (enemies are numbered from 1). */
export const PLAYER_INSTANCE = 0;

function round(value: number): number {
  return Math.round(value * 1000) / 1000 || 0;
}

function vector(point: Point): Vector3 {
  return [round(point[0]), 0, round(point[1])];
}

export function observeAsEnemy(world: SimWorld, enemy: SimEnemy, mode: ObservationMode, playerEntity: string): ObservationFrame {
  const sees = (pos: Point): boolean => mode === 'omniscient' || gap(enemy.pos, pos) <= world.config.sightRange;
  const entities: ObservedEntity[] = [];
  if (world.self.hp > 0 && sees(world.self.pos)) entities.push({ entity: playerEntity, instance: PLAYER_INSTANCE, pos: vector(world.self.pos), confidence: 1 });
  for (const other of world.enemies) {
    if (other === enemy || !other.alive || other.hp <= 0 || !sees(other.pos)) continue;
    entities.push({ entity: other.entity.id, instance: other.instance, pos: vector(other.pos), confidence: 1 });
  }
  const node = world.layout.nodeOf(enemy.pos);
  return {
    tick: world.tick,
    t: world.t,
    source: mode === 'player' ? 'render-tap' : 'game-api',
    mode,
    purpose: 'efficiency',
    self: { pos: vector(enemy.pos), hp: { value: round(Math.max(enemy.hp, 0) / enemy.maxHp), knowledge: 'shown' } },
    entities,
    stage: { id: world.stageId, elapsed: world.t, ...(node === undefined ? {} : { node }) },
    events: enemy.shotAt ? [{ kind: 'shot-at' }] : [],
    extra: { reach: enemy.range },
  };
}
// @ts-expect-error augur-inject
observeAsEnemy = contract(observeAsEnemy, { ...augurContract_178e5275, contractId: 'C-75', mode: 'observe', sample: 1, where: 'src/adapters/sim/enemy-observation.ts:23', rule: 'contract-wrap', id: '178e5275' }); /* augur-inject:contract-wrap:178e5275 */
