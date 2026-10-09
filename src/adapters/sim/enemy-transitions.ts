// State machine transitions of a simulated enemy. Transition `on` texts are prose for people,
// so the sim reads a transition by the conventional id of the state it leads to, and uses the
// transition's rule (if any) for the number:
// The target is the enemy's current target (sim-targets.ts: the nearest other fighter).
//   attack   the target is within range
//   chase    out of range (from attack); dodge over; retreat time over; back inside (from return)
//   dodge    shot at last tick, with dodgeChance; lasts the rule's value (closing_time = distance / shotSpeed)
//   retreat  hp at or under the rule's value (max_health = own maxHp; else 25 %) with the target within range
//   return   standing in a hazard node (e.g. outside the ring)
// Transitions to any other state never fire in the sim (documented in spec/feature/engine.md).

import type { Rule, StateMachine } from '../../domain/documents.ts';
import { gap } from './sim-motion.ts';
import { targetPos, type SimTarget } from './sim-targets.ts';
import { evaluateRule, statsOf, type Situation } from './sim-rules.ts';
import type { SimEnemy, SimWorld } from './sim-world.ts';

type Transition = StateMachine['transitions'][number];

const DEFAULT_RETREAT_RATIO = 0.25;

function ruleValue(world: SimWorld, enemy: SimEnemy, ruleId: string | undefined, situation: Situation): number | undefined {
  const rule: Rule | undefined = ruleId === undefined ? undefined : world.rules.get(ruleId);
  return rule === undefined ? undefined : evaluateRule(rule, situation, statsOf(enemy.entity, enemy.masked));
}

function inHazard(world: SimWorld, enemy: SimEnemy): boolean {
  const node = world.layout.nodeOf(enemy.pos);
  return node !== undefined && world.hazardNodes.has(node);
}

function holds(world: SimWorld, enemy: SimEnemy, transition: Transition, target: SimTarget): boolean {
  const distance = gap(enemy.pos, targetPos(world, target));
  switch (transition.to) {
    case 'attack':
      return distance <= enemy.range;
    case 'chase':
      if (transition.from === 'dodge') return world.t >= enemy.dodgeUntil;
      if (transition.from === 'retreat') return world.t - enemy.stateSince >= world.config.retreatSec;
      if (transition.from === 'return') return !inHazard(world, enemy);
      return distance > enemy.range;
    case 'dodge': {
      if (!enemy.shotAt || world.rng.next() >= world.config.dodgeChance) return false;
      const window = ruleValue(world, enemy, transition.rule, { closing_time: distance / world.config.shotSpeed, distance });
      enemy.dodgeUntil = world.t + (window ?? world.config.dodgeSec);
      return true;
    }
    case 'retreat': {
      const threshold = ruleValue(world, enemy, transition.rule, { max_health: enemy.maxHp, health: enemy.hp }) ?? enemy.maxHp * DEFAULT_RETREAT_RATIO;
      return enemy.hp <= threshold && distance <= enemy.range;
    }
    case 'return':
      return inHazard(world, enemy);
    default:
      return false;
  }
}

/** Moves the enemy along the first transition (document order) out of its state that holds. */
export function advanceEnemyState(world: SimWorld, enemy: SimEnemy, target: SimTarget): void {
  if (enemy.machine === undefined || enemy.state === undefined) return;
  for (const transition of enemy.machine.transitions) {
    if (transition.from !== enemy.state || !holds(world, enemy, transition, target)) continue;
    enemy.state = transition.to;
    enemy.stateSince = world.t;
    return;
  }
}
