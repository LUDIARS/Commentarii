// The situation of one human observation, written as a tactic `when` (design 4.4) the engine's
// matcher understands: the stage, each identified entity in sight (bound as $<kind>, $<kind>_2,
// ...), and low HP. Observations with the same situation share the key; the bindings let an
// action on an entity instance be written as `$enemy` instead of an instance number.

import { parseRef } from '../../domain/id.ts';
import { hpRatio } from '../../engine/observation/self-readings.ts';
import type { ObservationFrame } from '../../replay/observation-frame.ts';

/** HP bar ratio under which the situation counts as low HP (the sample tactics' threshold). */
export const LOW_HP_RATIO = 0.5;

export interface Situation {
  readonly key: string;
  readonly stage: string;
  readonly when: Readonly<Record<string, unknown>>;
  /** Entity IDs in sight, in ID order. */
  readonly entities: readonly string[];
  /** Entity instance -> binding name ($enemy, ...). */
  readonly bindings: ReadonlyMap<number, string>;
}

function bindingNames(entities: readonly string[]): Map<string, string> {
  const perKind = new Map<string, number>();
  const names = new Map<string, string>();
  for (const id of entities) {
    const kind = parseRef(id)?.kind ?? 'entity';
    const count = (perKind.get(kind) ?? 0) + 1;
    perKind.set(kind, count);
    names.set(id, count === 1 ? `$${kind}` : `$${kind}_${count}`);
  }
  return names;
}

export function situationOf(observation: ObservationFrame): Situation {
  const entities = [...new Set(observation.entities.flatMap((entity) => (entity.entity === undefined ? [] : [entity.entity])))].sort();
  const names = bindingNames(entities);
  const bindings = new Map<number, string>();
  for (const entity of observation.entities) {
    const name = entity.entity === undefined ? undefined : names.get(entity.entity);
    if (name !== undefined) bindings.set(entity.instance, name);
  }
  const ratio = hpRatio(observation);
  const leaves: Record<string, unknown>[] = [
    { stage: { id: observation.stage.id } },
    ...entities.map((id) => {
      const name = names.get(id);
      const isDefault = name === `$${parseRef(id)?.kind ?? ''}`;
      return { entity: id, visible: true, ...(isDefault || name === undefined ? {} : { as: name }) };
    }),
    ...(ratio !== undefined && ratio < LOW_HP_RATIO ? [{ self: { hp_ratio_lt: LOW_HP_RATIO } }] : []),
  ];
  const when = { all: leaves };
  return { key: JSON.stringify(when), stage: observation.stage.id, when, entities, bindings };
}
