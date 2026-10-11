// Guide ID grammar (design 4.1): <kind>:<game-id>:<slug>[:<slug>...][#<sub-state>][.<field path>]
// Map nodes are stage-local (node:<slug>); Ludus dictionary entries are lexicon:<id>.

const SEGMENT = '[a-z0-9][a-z0-9_-]*';
const ID_PATTERN = new RegExp(`^([a-z][a-z0-9-]*):(${SEGMENT}):(${SEGMENT}(?::${SEGMENT})*)(?:#(${SEGMENT}))?((?:\\.[a-z0-9_]+)*)$`);
const NODE_PATTERN = new RegExp(`^node:${SEGMENT}$`);

/** Kinds whose records live in the bundle and must therefore resolve (validate V02). */
export const BUNDLE_KINDS = ['enemy', 'item', 'skill', 'actor', 'stage', 'rule', 'state', 'tactic', 'intent'] as const;
export type BundleKind = (typeof BUNDLE_KINDS)[number];

export const ENTITY_KINDS = ['enemy', 'item', 'skill', 'actor'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/** entities/<group>/ directory name for each entity kind. */
export const ENTITY_GROUP_OF_KIND: Readonly<Record<EntityKind, string>> = {
  enemy: 'enemies',
  item: 'items',
  skill: 'skills',
  actor: 'actors',
};

export interface ParsedRef {
  /** `<kind>:<game>:<slug...>` without fragment or field path. */
  readonly base: string;
  readonly kind: string;
  readonly game: string;
  readonly slug: string;
  readonly fragment: string | undefined;
  /** Field path segments after the base (`enemy:g:x.stats.hp` -> ['stats', 'hp']). */
  readonly path: readonly string[];
}

export function parseRef(text: string): ParsedRef | undefined {
  const match = ID_PATTERN.exec(text);
  if (!match) return undefined;
  const [, kind = '', game = '', slug = '', fragment, pathText = ''] = match;
  return {
    base: `${kind}:${game}:${slug}`,
    kind,
    game,
    slug,
    fragment,
    path: pathText === '' ? [] : pathText.slice(1).split('.'),
  };
}

export function isNodeId(text: string): boolean {
  return NODE_PATTERN.test(text);
}

export function isBundleKind(kind: string): kind is BundleKind {
  return (BUNDLE_KINDS as readonly string[]).includes(kind);
}

export function isEntityKind(kind: string): kind is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(kind);
}
