// Bundle rules inside the sim: a rule expression is evaluated with situation variables first
// (closing_time, distance, ...), then the evaluating fighter's own stat named by the
// variable's `ref` field (enemy:g:x.stats.health -> its own health), then the rule's example.
// Damage uses the bundle rule `rule:<game>:damage` when there is one, else the sim's formula.

import type { Entity, MaskedEntity, Rule } from '../../domain/documents.ts';
import { evaluateExpression } from '../../domain/expression/evaluate-expression.ts';
import { parseRef } from '../../domain/id.ts';
import type { SimFighter, SimWorld } from './sim-world.ts';

export type Situation = Readonly<Record<string, number>>;

/** Numeric stats of an entity, public and masked (the sim is the game: it knows everything). */
export function statsOf(entity: Entity | undefined, masked?: MaskedEntity): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const source of [entity?.stats, masked?.stats]) {
    for (const [name, value] of Object.entries(source ?? {})) {
      if (typeof value.value === 'number') stats[name] = value.value;
    }
  }
  return stats;
}

export function evaluateRule(rule: Rule, situation: Situation, stats: Readonly<Record<string, number>>): number {
  const variables: Record<string, number> = {};
  for (const [name, variable] of Object.entries(rule.variables)) {
    const field = variable.ref === undefined ? undefined : parseRef(variable.ref)?.path.at(-1);
    variables[name] = situation[name] ?? (field === undefined ? undefined : stats[field]) ?? variable.example;
  }
  return evaluateExpression(rule.expression, variables);
}

export function damageOf(world: SimWorld, attacker: SimFighter, distance: number, stats: Readonly<Record<string, number>>): number {
  const situation = { power: attacker.power, cooldown: attacker.cooldown, distance, range: attacker.range };
  const damage = world.damageRule === undefined ? evaluateExpression(world.config.damageExpression, situation) : evaluateRule(world.damageRule, situation, stats);
  return Math.max(damage, 0);
}
