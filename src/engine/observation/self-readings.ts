// What the engine reads about itself from an observation (adapter conventions in
// spec/feature/adapter-protocol.md): hp as a ratio, resources, ready skills, held items, reach.

import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservationFrame, ObservedValue } from '../../replay/observation-frame.ts';

function numberOf(value: number | ObservedValue | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value === undefined) return undefined;
  return typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : undefined;
}

/** self.hp.value is the HP bar as a ratio 0..1 (design 7.2 example). Unknown when absent. */
export function hpRatio(observation: ObservationFrame): number | undefined {
  const value = numberOf(observation.self.hp);
  return value === undefined ? undefined : Math.min(Math.max(value, 0), 1);
}

export function resourceAmount(observation: ObservationFrame, name: string): number | undefined {
  return numberOf(observation.self.resources?.[name]);
}

/** Every numeric resource of self, in name order. */
export function resourceAmounts(observation: ObservationFrame): [string, number][] {
  const resources = observation.self.resources ?? {};
  return Object.keys(resources)
    .sort()
    .flatMap((name) => {
      const amount = resourceAmount(observation, name);
      return amount === undefined ? [] : [[name, amount] as [string, number]];
    });
}

/** extra.ready_skills: skill IDs usable this tick. */
export function readySkills(observation: ObservationFrame): readonly string[] {
  const value = observation.extra?.ready_skills;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** extra.items: item ID -> count held. */
export function heldItemCount(observation: ObservationFrame, item: string): number {
  const items = observation.extra?.items;
  if (!isJsonObject(items)) return 0;
  const count = items[item];
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

/** extra.reach: how far the own basic attack reaches (shown to the player). */
export function reach(observation: ObservationFrame): number | undefined {
  const value = observation.extra?.reach;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}
