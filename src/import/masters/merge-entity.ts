// Re-import rule (design 6: import masters is re-runnable). An imported entity is merged into
// the entity files already in the bundle:
// - only values whose current source.kind is master are overwritten; observed / human /
//   llm-draft values are kept as they are;
// - a master value keeps a boundary that was promoted after import (the looser of the current
//   and the mapped knowledge), so an import never takes a promotion back;
// - fields the mapping does not produce are kept;
// - masked values land in the .masked.json companion, every other value in the public file.

import type { GuideValue } from '../../domain/documents.ts';
import { KNOWLEDGE_LEVELS, isKnowledge, type Knowledge } from '../../domain/knowledge.ts';
import { isJsonObject, isValueNode, type JsonObject } from '../../domain/value-node.ts';
import { ImportError } from '../import-error.ts';
import type { ImportedEntity } from './build-imported-entities.ts';

export interface MergedEntity {
  readonly public: JsonObject;
  /** undefined when the entity has no masked value left. */
  readonly masked: JsonObject | undefined;
}

/** Leading keys of a public entity file; the rest keep their current order. */
const PUBLIC_KEY_ORDER = ['id', 'name', 'lexicon', 'render_signature', 'stats'];

function looser(a: Knowledge, b: Knowledge): Knowledge {
  return KNOWLEDGE_LEVELS.indexOf(a) <= KNOWLEDGE_LEVELS.indexOf(b) ? a : b;
}

function sourceKindOf(node: JsonObject): unknown {
  return isJsonObject(node.source) ? node.source.kind : undefined;
}

function mergeValue(current: unknown, imported: GuideValue<number>): unknown {
  if (!isValueNode(current)) return imported;
  if (sourceKindOf(current) !== 'master') return current;
  return isKnowledge(current.knowledge) ? { ...imported, knowledge: looser(current.knowledge, imported.knowledge) } : imported;
}

function statsOf(document: JsonObject): JsonObject {
  return isJsonObject(document.stats) ? document.stats : {};
}

function orderKeys(document: JsonObject): JsonObject {
  const ordered: JsonObject = {};
  for (const key of PUBLIC_KEY_ORDER) if (Object.hasOwn(document, key)) ordered[key] = document[key];
  for (const [key, value] of Object.entries(document)) if (!Object.hasOwn(ordered, key)) ordered[key] = value;
  return ordered;
}

function mergedStats(imported: ImportedEntity, publicStats: JsonObject, maskedStats: JsonObject): Map<string, unknown> {
  const stats = new Map<string, unknown>(Object.entries(publicStats));
  for (const [key, value] of Object.entries(maskedStats)) {
    if (stats.has(key)) throw new ImportError(`${imported.id}: stat '${key}' is in both the entity file and its .masked.json; keep one before re-importing`);
    stats.set(key, value);
  }
  for (const [key, value] of imported.stats) stats.set(key, mergeValue(stats.get(key), value));
  return stats;
}

function isMaskedEntry(value: unknown, fromMaskedFile: boolean): boolean {
  // A malformed entry (not a value) stays in the file it came from.
  return isValueNode(value) ? value.knowledge === 'masked' : fromMaskedFile;
}

export function mergeEntity(imported: ImportedEntity, currentPublic: unknown, currentMasked: unknown): MergedEntity {
  const existing = isJsonObject(currentPublic) ? currentPublic : {};
  const existingMasked = isJsonObject(currentMasked) ? currentMasked : {};
  const maskedKeys = new Set(Object.keys(statsOf(existingMasked)));
  const publicStats: JsonObject = {};
  const maskedStats: JsonObject = {};
  for (const [key, value] of mergedStats(imported, statsOf(existing), statsOf(existingMasked))) {
    if (isMaskedEntry(value, maskedKeys.has(key))) maskedStats[key] = value;
    else publicStats[key] = value;
  }

  const document: JsonObject = { ...existing, id: imported.id, name: imported.name };
  if (imported.behavior !== undefined) document.behavior = imported.behavior;
  if (imported.renderSignature !== undefined) {
    const current = isJsonObject(existing.render_signature) ? existing.render_signature : {};
    document.render_signature = { ...current, ...imported.renderSignature };
  }
  if (Object.keys(publicStats).length > 0) document.stats = publicStats;
  else delete document.stats;

  const masked: JsonObject = { id: imported.id };
  if (Object.keys(maskedStats).length > 0) masked.stats = maskedStats;
  if (existingMasked.fields !== undefined) masked.fields = existingMasked.fields;
  return { public: orderKeys(document), masked: Object.keys(masked).length > 1 ? masked : undefined };
}
