// The engine's action applied to the simulated self:
//   move_to  node (walk toward it), instance (toward that enemy) or [x, y, z] (toward the point)
//   attack   an enemy instance within range when the cooldown allows; a dodging enemy is missed
//   wait, and verbs the sim has nothing for (use_item / use_skill / interact / custom), do nothing.

import type { ActionOperand, ReplayAction } from '../../replay/replay-action.ts';
import type { Point } from './sim-layout.ts';
import { gap, stepToward } from './sim-motion.ts';
import { damageOf, statsOf } from './sim-rules.ts';
import type { SimEnemy, SimWorld } from './sim-world.ts';

function enemyAt(world: SimWorld, operand: ActionOperand | undefined): SimEnemy | undefined {
  return typeof operand === 'number' ? world.enemies.find((enemy) => enemy.alive && enemy.instance === operand) : undefined;
}

function destination(world: SimWorld, operand: ActionOperand): Point | undefined {
  if (typeof operand === 'string') return world.layout.pointOf(operand, world.self.pos);
  if (typeof operand === 'number') return enemyAt(world, operand)?.pos;
  if (operand.length === 3) return [operand[0] ?? 0, operand[2] ?? 0];
  return operand.length === 2 ? [operand[0] ?? 0, operand[1] ?? 0] : undefined;
}

function attack(world: SimWorld, enemy: SimEnemy): void {
  const self = world.self;
  const distance = gap(self.pos, enemy.pos);
  if (world.t < self.readyAt || distance > self.range) return;
  self.readyAt = world.t + self.cooldown;
  enemy.shotAt = true;
  if (enemy.state === 'dodge') return;
  const damage = damageOf(world, self, distance, statsOf(undefined));
  enemy.hp -= damage;
  world.damageDealt += damage;
}

export function applySelfAction(world: SimWorld, action: ReplayAction): void {
  if (action.move_to !== undefined) {
    const target = destination(world, action.move_to);
    if (target === undefined) return;
    const next = stepToward(world.self.pos, target, world.self.speed * world.config.dt);
    world.self.moved = next[0] !== world.self.pos[0] || next[1] !== world.self.pos[1];
    world.self.pos = next;
    return;
  }
  if (action.attack !== undefined) {
    const enemy = enemyAt(world, action.attack);
    if (enemy !== undefined) attack(world, enemy);
  }
}
