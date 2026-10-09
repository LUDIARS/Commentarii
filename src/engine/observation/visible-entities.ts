// Queries over the entities an observation lists (only what the adapter could see).

import { parseRef } from '../../domain/id.ts';
import type { ObservationFrame, ObservedEntity } from '../../replay/observation-frame.ts';
import { distance } from './geometry.ts';

/** Distance from self to the entity, undefined when either position is unknown. */
export function distanceTo(observation: ObservationFrame, entity: ObservedEntity): number | undefined {
  const self = observation.self.pos;
  if (self === undefined || entity.pos === undefined) return undefined;
  return distance(self, entity.pos);
}

export function findInstance(observation: ObservationFrame, instance: number): ObservedEntity | undefined {
  return observation.entities.find((entity) => entity.instance === instance);
}

/** Nearest first; unknown distances last; instance order on ties (deterministic). */
export function sortByDistance(observation: ObservationFrame, entities: readonly ObservedEntity[]): ObservedEntity[] {
  const keyed = entities.map((entity) => ({ entity, d: distanceTo(observation, entity) ?? Number.POSITIVE_INFINITY }));
  keyed.sort((a, b) => a.d - b.d || a.entity.instance - b.entity.instance);
  return keyed.map(({ entity }) => entity);
}

/** Identified entities of a kind (enemy / item / actor ...), nearest first. */
export function entitiesOfKind(observation: ObservationFrame, kind: string): ObservedEntity[] {
  return sortByDistance(
    observation,
    observation.entities.filter((entity) => entity.entity !== undefined && parseRef(entity.entity)?.kind === kind),
  );
}
