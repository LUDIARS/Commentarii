// An enemy brain's action applied to its simulated enemy (stage 6F), with the same moves and the
// same attack as the fixed tree (enemy-act.ts), so the two can be compared tick for tick:
//   move_to  node (return: walk toward it), instance (chase: walk toward, keeping a gap; 0 = the
//            player) or [x, y, z]
//   attack   an instance within range when the cooldown allows
//   custom   dodge (sidestep the threat; immune while dodging, as the fixed tree) / retreat
//            (back away from it); the threat is `target`, else the nearest fighter
//   wait     nothing
// The enemy's state is set to the matching fixed-tree state so the rest of the sim (who can be
// hit while dodging) treats both the same way.

import type { ActionOperand, ReplayAction } from '../../replay/replay-action.ts';
import { attackTarget, CLOSEST_APPROACH } from './enemy-act.ts';
import { PLAYER_INSTANCE } from './enemy-observation.ts';
import type { Point } from './sim-layout.ts';
import { gap, stepAway, stepSideways, stepToward } from './sim-motion.ts';
import { nearestTarget, targetPos, type SimTarget } from './sim-targets.ts';
import type { SimEnemy, SimWorld } from './sim-world.ts';

function targetOf(world: SimWorld, operand: ActionOperand | undefined): SimTarget | undefined {
  if (operand === PLAYER_INSTANCE) return world.self.hp > 0 ? { kind: 'self' } : undefined;
  if (typeof operand !== 'number') return undefined;
  const enemy = world.enemies.find((candidate) => candidate.alive && candidate.instance === operand);
  return enemy === undefined ? undefined : { kind: 'enemy', enemy };
}

function pointOf(world: SimWorld, enemy: SimEnemy, operand: ActionOperand): Point | undefined {
  if (typeof operand === 'string') return world.layout.pointOf(operand, enemy.pos);
  const target = targetOf(world, operand);
  if (target !== undefined) return targetPos(world, target);
  if (typeof operand === 'number') return undefined;
  if (operand.length === 3) return [operand[0] ?? 0, operand[2] ?? 0];
  return operand.length === 2 ? [operand[0] ?? 0, operand[1] ?? 0] : undefined;
}

function enter(world: SimWorld, enemy: SimEnemy, state: string): void {
  if (enemy.state !== state) enemy.stateSince = world.t;
  enemy.state = state;
}

export function applyEnemyAction(world: SimWorld, enemy: SimEnemy, action: ReplayAction): void {
  const step = enemy.speed * world.config.dt;
  if (action.move_to !== undefined) {
    const goal = pointOf(world, enemy, action.move_to);
    if (goal === undefined) return;
    const returning = typeof action.move_to === 'string';
    enter(world, enemy, returning ? 'return' : 'chase');
    enemy.pos = stepToward(enemy.pos, goal, step, returning ? 0 : CLOSEST_APPROACH);
    return;
  }
  if (action.attack !== undefined) {
    const target = targetOf(world, action.attack);
    if (target === undefined) return;
    enter(world, enemy, 'attack');
    attackTarget(world, enemy, target, gap(enemy.pos, targetPos(world, target)));
    return;
  }
  if (action.custom === 'dodge' || action.custom === 'retreat') {
    const threat = targetPos(world, targetOf(world, action.target) ?? nearestTarget(world, enemy));
    enter(world, enemy, action.custom);
    enemy.pos = action.custom === 'dodge' ? stepSideways(enemy.pos, threat, step) : stepAway(enemy.pos, threat, step);
  }
}
