// Maps a bundle-relative path to the kind of document it holds (design 4.2).

import type { DocumentSchemaName } from '../schema/schema-names.ts';

export type FileKind =
  | 'manifest'
  | 'glossary'
  | 'entity'
  | 'entity-masked'
  | 'stage'
  | 'map'
  | 'events'
  | 'rule'
  | 'state'
  | 'tactic'
  | 'intent';

export const SCHEMA_OF_KIND: Readonly<Record<FileKind, DocumentSchemaName>> = {
  manifest: 'manifest',
  glossary: 'glossary',
  entity: 'entity',
  'entity-masked': 'entity.masked',
  stage: 'stage',
  map: 'map',
  events: 'events',
  rule: 'rule',
  state: 'state',
  tactic: 'tactic',
  intent: 'intent',
};

export type PathClass =
  | { readonly type: 'document'; readonly kind: FileKind; readonly group?: string; readonly slug?: string }
  /** Overlay, schema references and non-JSON files are not part of the canonical bundle. */
  | { readonly type: 'ignored' }
  | { readonly type: 'unknown' };

const SLUG = '([a-z0-9][a-z0-9_-]*)';
const PATTERNS: readonly { readonly pattern: RegExp; readonly kind: FileKind; readonly hasGroup?: true }[] = [
  { pattern: /^manifest\.json$/, kind: 'manifest' },
  { pattern: /^glossary\.json$/, kind: 'glossary' },
  { pattern: new RegExp(`^entities/(enemies|items|skills|actors)/${SLUG}\\.masked\\.json$`), kind: 'entity-masked', hasGroup: true },
  { pattern: new RegExp(`^entities/(enemies|items|skills|actors)/${SLUG}\\.json$`), kind: 'entity', hasGroup: true },
  { pattern: new RegExp(`^stages/${SLUG}/stage\\.json$`), kind: 'stage' },
  { pattern: new RegExp(`^stages/${SLUG}/map\\.json$`), kind: 'map' },
  { pattern: new RegExp(`^stages/${SLUG}/events\\.json$`), kind: 'events' },
  { pattern: new RegExp(`^mechanics/rules/${SLUG}\\.json$`), kind: 'rule' },
  { pattern: new RegExp(`^mechanics/states/${SLUG}\\.json$`), kind: 'state' },
  { pattern: new RegExp(`^tactics/${SLUG}\\.json$`), kind: 'tactic' },
  { pattern: new RegExp(`^intent/${SLUG}\\.json$`), kind: 'intent' },
];

/**
 * Overlay, schema references, the import inputs (master data, mapping) and the engine's
 * personas (read by the engine, not part of the guide itself) and the feasibility bands derived by
 * guide verify intent (stage 5) kept next to the bundle.
 */
const IGNORED_PREFIXES = ['observations/', 'schema/', 'masters/', 'personas/', 'feasibility/'];

export function classifyPath(relativePath: string): PathClass {
  if (IGNORED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return { type: 'ignored' };
  if (!relativePath.endsWith('.json')) return { type: 'ignored' };
  for (const { pattern, kind, hasGroup } of PATTERNS) {
    const match = pattern.exec(relativePath);
    if (!match) continue;
    if (hasGroup) return { type: 'document', kind, group: match[1] ?? '', slug: match[2] ?? '' };
    return match[1] === undefined ? { type: 'document', kind } : { type: 'document', kind, slug: match[1] };
  }
  return { type: 'unknown' };
}
