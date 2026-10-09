// Free-for-all targeting (Bestia's battle is "last monster standing"): every enemy fights the
// nearest other living fighter, which may be self or another enemy. Damage dealt to a target
// goes through here so self and enemies are hit the same way.

import type { Point } from './sim-layout.ts';
import { gap } from './sim-motion.ts';
import type { SimEnemy, SimWorld } from './sim-world.ts';

export type SimTarget = { readonly kind: 'self' } | { readonly kind: 'enemy'; readonly enemy: SimEnemy };

export function targetPos(world: SimWorld, target: SimTarget): Point {
  return target.kind === 'self' ? world.self.pos : target.enemy.pos;
}

/** The nearest other living fighter; self wins ties (it is listed first). */
export function nearestTarget(world: SimWorld, enemy: SimEnemy): SimTarget {
  let best: SimTarget = { kind: 'self' };
  let bestDistance = gap(enemy.pos, world.self.pos);
  for (const other of world.enemies) {
    if (other === enemy || !other.alive || other.hp <= 0) continue;
    const d = gap(enemy.pos, other.pos);
    if (d < bestDistance) [best, bestDistance] = [{ kind: 'enemy', enemy: other }, d];
  }
  return best;
}

/** Applies a landed hit of `damage` from `attacker` to the target (moving self may evade). */
export function hitTarget(world: SimWorld, attacker: SimEnemy, target: SimTarget, damage: number): void {
  if (target.kind === 'enemy') {
    target.enemy.shotAt = true;
    if (target.enemy.state !== 'dodge') target.enemy.hp -= damage;
    return;
  }
  if (world.self.moved && world.rng.next() < world.config.movingEvasion) {
    world.events.push({ kind: 'miss', instance: attacker.instance });
    return;
  }
  world.self.hp -= damage;
  world.self.lastDamagedT = world.t;
  world.damageTaken += damage;
  world.events.push({ kind: 'hit', instance: attacker.instance });
}
