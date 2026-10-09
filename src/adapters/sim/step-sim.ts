// One simulated tick: self acts, every living enemy picks its target (the nearest other
// fighter), moves along its state machine and acts, the fallen are removed, self regenerates
// when it has been left alone, the clock advances and the outcome is settled (every enemy down
// = success; self down or time over = fail).

import type { ReplayAction } from '../../replay/replay-action.ts';
import { applySelfAction } from './apply-self-action.ts';
import { actEnemy } from './enemy-act.ts';
import { advanceEnemyState } from './enemy-transitions.ts';
import { nearestTarget } from './sim-targets.ts';
import type { SimWorld } from './sim-world.ts';

function removeFallen(world: SimWorld): void {
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.hp > 0) continue;
    enemy.alive = false;
    world.events.push({ kind: 'kill', instance: enemy.instance });
  }
}

export function stepSim(world: SimWorld, action: ReplayAction): void {
  if (world.outcome !== 'running') throw new Error('the simulated game has already ended');
  world.events = [];
  for (const enemy of world.enemies) enemy.shotAt = false;
  world.self.moved = false;
  applySelfAction(world, action);
  removeFallen(world);
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.hp <= 0) continue;
    const target = nearestTarget(world, enemy);
    advanceEnemyState(world, enemy, target);
    actEnemy(world, enemy, target);
  }
  removeFallen(world);
  const self = world.self;
  if (self.hp > 0 && world.t - self.lastDamagedT >= world.config.regenDelaySec) {
    self.hp = Math.min(self.maxHp, self.hp + world.config.regenPerSec * world.config.dt);
  }
  world.tick += 1;
  world.t = Math.round((world.t + world.config.dt) * 1e6) / 1e6;
  if (self.hp <= 0) world.outcome = 'fail';
  else if (world.enemies.every((enemy) => !enemy.alive)) world.outcome = 'success';
  else if (world.timeLimit !== undefined && world.t >= world.timeLimit) world.outcome = 'fail';
}
