// SimWorld -> ObservationFrame (design 7.2). The sim knows everything; what it shows depends on
// the mode, and keeping masked values out of player observations is its duty as an adapter:
//   player      living enemies within sight, their state only when the state machine is not
//               masked, self HP as the shown ratio, own reach. No masked value, ever.
//   omniscient  every living enemy, plus extra.enemy_hp and extra.masked_stats (masked values
//               labelled masked), for checking and debugging only.

import type { ObservationFrame, ObservationMode, ObservationPurpose, ObservedEntity, Vector3 } from '../../replay/observation-frame.ts';
import { gap } from './sim-motion.ts';
import type { Point } from './sim-layout.ts';
import type { SimEnemy, SimWorld } from './sim-world.ts';

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function vector(point: Point): Vector3 {
  return [round(point[0]), 0, round(point[1])];
}

function stateGuess(enemy: SimEnemy, mode: ObservationMode): string | undefined {
  if (enemy.machine === undefined || enemy.state === undefined) return undefined;
  if (mode === 'player' && enemy.machine.knowledge === 'masked') return undefined;
  return `${enemy.machine.id}#${enemy.state}`;
}

function observedEnemy(enemy: SimEnemy, mode: ObservationMode): ObservedEntity {
  const state = stateGuess(enemy, mode);
  return { entity: enemy.entity.id, instance: enemy.instance, pos: vector(enemy.pos), ...(state === undefined ? {} : { state_guess: state }), confidence: 1 };
}

function omniscientExtra(enemies: readonly SimEnemy[]): Record<string, unknown> {
  const enemyHp: Record<string, number> = {};
  const maskedStats: { instance: number; field: string; value: unknown; knowledge: 'masked' }[] = [];
  for (const enemy of enemies) {
    enemyHp[String(enemy.instance)] = round(enemy.hp);
    for (const [field, value] of Object.entries(enemy.masked?.stats ?? {})) {
      maskedStats.push({ instance: enemy.instance, field, value: value.value, knowledge: 'masked' });
    }
  }
  return { enemy_hp: enemyHp, masked_stats: maskedStats };
}

export function observeSim(world: SimWorld, mode: ObservationMode, purpose: ObservationPurpose): ObservationFrame {
  const living = world.enemies.filter((enemy) => enemy.alive);
  const seen = mode === 'player' ? living.filter((enemy) => gap(enemy.pos, world.self.pos) <= world.config.sightRange) : living;
  const node = world.layout.nodeOf(world.self.pos);
  return {
    tick: world.tick,
    t: world.t,
    source: mode === 'player' ? 'render-tap' : 'game-api',
    mode,
    purpose,
    self: { pos: vector(world.self.pos), hp: { value: round(Math.max(world.self.hp, 0) / world.self.maxHp), knowledge: 'shown' } },
    entities: seen.map((enemy) => observedEnemy(enemy, mode)),
    stage: { id: world.stageId, elapsed: world.t, ...(node === undefined ? {} : { node }) },
    events: world.events,
    extra: { reach: world.self.range, ...(mode === 'omniscient' ? omniscientExtra(living) : {}) },
  };
}
