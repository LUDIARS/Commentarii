// identify (design 7.3) for play logs: game identifier -> guide entity ID. The mapping's own
// table wins; otherwise the ID rule of a guide import masters table is reused (its kind, and
// the identifier read as the ID slug, slugified when that table slugifies), and the result
// must be an entity of the bundle. Anything else stays unidentified: the observation keeps the
// instance only, never the raw game identifier.

import { ENTITY_KINDS } from '../../domain/id.ts';
import type { TableMapping } from '../mapping.ts';
import { slugify } from '../masters/slug-of.ts';

export type Identify = (gameIdentifier: string) => string | undefined;

export interface IdentifySources {
  readonly gameId: string;
  readonly entityIds: ReadonlySet<string>;
  readonly table?: Readonly<Record<string, string>>;
  readonly masters?: TableMapping;
}

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

function fromMasters(sources: IdentifySources, masters: TableMapping, identifier: string): string | undefined {
  const slug = masters.id.slugify === true ? slugify(identifier) : identifier;
  if (!SLUG.test(slug)) return undefined;
  // A table whose kind comes from a column cannot name the kind here: try every kind and accept
  // only an unambiguous match in the bundle.
  const kinds = typeof masters.kind === 'string' ? [masters.kind] : ENTITY_KINDS;
  const found = kinds.map((kind) => `${kind}:${sources.gameId}:${slug}`).filter((id) => sources.entityIds.has(id));
  return found.length === 1 ? found[0] : undefined;
}

export function createIdentify(sources: IdentifySources): Identify {
  return (gameIdentifier) => {
    const declared = sources.table?.[gameIdentifier];
    if (declared !== undefined) return declared;
    return sources.masters === undefined ? undefined : fromMasters(sources, sources.masters, gameIdentifier);
  };
}
