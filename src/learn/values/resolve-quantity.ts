// Which canonical value an estimate is about: the entity's stat named like the quantity, else
// the stat whose unit is the quantity (an `hp` estimate meets `stats.health` with unit hp).
// Looked up in the entity file and in its .masked.json, since learning works on the full
// bundle (it is the guide maker, not the player engine) and promotion is about masked values.

import type { Bundle } from '../../bundle/bundle.ts';
import type { GuideValue, StatMap } from '../../domain/documents.ts';

export interface CanonicalValue {
  /** <entity ID>.stats.<key> */
  readonly ref: string;
  readonly key: string;
  readonly file: string;
  /** The file is the entity's .masked.json. */
  readonly masked: boolean;
  readonly value: GuideValue<number>;
}

function statKey(stats: StatMap | undefined, quantity: string): string | undefined {
  if (stats === undefined) return undefined;
  if (Object.hasOwn(stats, quantity)) return quantity;
  return Object.keys(stats)
    .sort()
    .find((key) => stats[key]?.unit === quantity);
}

function found(entity: string, key: string, file: string, masked: boolean, value: GuideValue<number> | undefined): CanonicalValue | undefined {
  return value === undefined || typeof value.value !== 'number' ? undefined : { ref: `${entity}.stats.${key}`, key, file, masked, value };
}

export function resolveQuantity(bundle: Bundle, entity: string, quantity: string): CanonicalValue | undefined {
  const open = bundle.entities.find(({ doc }) => doc.id === entity);
  const openKey = statKey(open?.doc.stats, quantity);
  if (open !== undefined && openKey !== undefined) return found(entity, openKey, open.path, false, open.doc.stats?.[openKey]);
  const hidden = bundle.maskedEntities.find(({ doc }) => doc.id === entity);
  const hiddenKey = statKey(hidden?.doc.stats, quantity);
  if (hidden !== undefined && hiddenKey !== undefined) return found(entity, hiddenKey, hidden.path, true, hidden.doc.stats?.[hiddenKey]);
  return undefined;
}
