// Resolves a reference string against the bundle index: does it exist, and which knowledge
// boundary does it carry.

import { isBundleKind, isNodeId, parseRef, type ParsedRef } from '../domain/id.ts';
import type { Knowledge } from '../domain/knowledge.ts';
import { isJsonObject } from '../domain/value-node.ts';
import type { BundleIndex } from './bundle-index.ts';

function hasField(document: unknown, path: readonly string[]): boolean {
  if (path.length === 0) return true;
  if (Array.isArray(document)) return document.some((item) => hasField(item, path));
  if (!isJsonObject(document)) return false;
  const [head, ...rest] = path;
  if (head === undefined || !Object.hasOwn(document, head)) return false;
  return hasField(document[head], rest);
}

function nodeExists(index: BundleIndex, node: string): boolean {
  for (const nodes of index.stageNodes.values()) if (nodes.has(node)) return true;
  return false;
}

/**
 * Why the reference does not resolve, or undefined when it does. References to kinds that do
 * not live in the bundle (attr:, mesh:, mat:, run:, lexicon:) are external and always resolve.
 */
export function unresolvedReason(index: BundleIndex, ref: string): string | undefined {
  if (isNodeId(ref)) return nodeExists(index, ref) ? undefined : `map node ${ref} does not exist`;
  const parsed = parseRef(ref);
  if (parsed === undefined) return `${ref} is not a valid reference`;
  if (!isBundleKind(parsed.kind)) return undefined;
  if (!index.records.has(parsed.base)) return `${parsed.base} does not exist`;
  if (parsed.fragment !== undefined) {
    const states = index.subStates.get(parsed.base);
    if (!states?.has(parsed.fragment)) return `${parsed.base} has no state '${parsed.fragment}'`;
  }
  if (parsed.path.length > 0) {
    const documents = index.entityDocuments.get(parsed.base) ?? [];
    if (!documents.some((document) => hasField(document, parsed.path))) return `${parsed.base} has no field ${parsed.path.join('.')}`;
  }
  return undefined;
}

function fieldKnowledge(index: BundleIndex, parsed: ParsedRef): Knowledge[] {
  const key = `${parsed.base}.${parsed.path.join('.')}`;
  const levels: Knowledge[] = [];
  for (const [field, knowledge] of index.valueKnowledge) {
    if (field === key || field.startsWith(`${key}.`)) levels.push(...knowledge);
  }
  return levels;
}

/**
 * Knowledge labels a reference touches. A bare entity ID names the entity itself and adds no
 * constraint; a field path (enemy:g:x.stats.hp) carries the labels of the values under it.
 */
export function referencedKnowledge(index: BundleIndex, ref: string): Knowledge[] {
  if (isNodeId(ref)) {
    const levels: Knowledge[] = [];
    for (const nodes of index.stageNodes.values()) {
      const level = nodes.get(ref);
      if (level !== undefined) levels.push(level);
    }
    return levels;
  }
  const parsed = parseRef(ref);
  if (parsed === undefined) return [];
  if (parsed.path.length > 0) return fieldKnowledge(index, parsed);
  const record = index.records.get(parsed.base);
  return record?.knowledge ? [record.knowledge] : [];
}
