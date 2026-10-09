// What a simulated enemy does in its current state toward its target (sim-targets.ts; the
// conventional state ids are explained in enemy-transitions.ts): chase closes in, attack hits
// when its cooldown allows, dodge sidesteps, retreat backs off, return heads for the middle.
// An enemy without a state machine attacks when in range and chases otherwise.

import { gap, stepAway, stepSideways, stepToward } from './sim-motion.ts';
import { damageOf, statsOf } from './sim-rules.ts';
import { hitTarget, targetPos, type SimTarget } from './sim-targets.ts';
import type { SimEnemy, SimWorld } from './sim-world.ts';

/** How close a chasing enemy comes (it stops instead of standing on the target). */
const CLOSEST_APPROACH = 1.5;

function attack(world: SimWorld, enemy: SimEnemy, target: SimTarget, distance: number): void {
  if (world.t < enemy.readyAt || distance > enemy.range) return;
  enemy.readyAt = world.t + enemy.cooldown;
  const damage = damageOf(world, enemy, distance, statsOf(enemy.entity, enemy.masked));
  if (damage > 0) hitTarget(world, enemy, target, damage);
}

export function actEnemy(world: SimWorld, enemy: SimEnemy, target: SimTarget): void {
  const step = enemy.speed * world.config.dt;
  const goal = targetPos(world, target);
  const distance = gap(enemy.pos, goal);
  const state = enemy.machine === undefined ? (distance <= enemy.range ? 'attack' : 'chase') : enemy.state;
  switch (state) {
    case 'chase':
      enemy.pos = stepToward(enemy.pos, goal, step, CLOSEST_APPROACH);
      return;
    case 'attack':
      attack(world, enemy, target, distance);
      return;
    case 'dodge':
      enemy.pos = stepSideways(enemy.pos, goal, step);
      return;
    case 'retreat':
      enemy.pos = stepAway(enemy.pos, goal, step);
      return;
    case 'return':
      enemy.pos = stepToward(enemy.pos, [0, 0], step);
      return;
    default:
      return;
  }
}
