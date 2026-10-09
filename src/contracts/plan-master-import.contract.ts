// C-12 planMasterImport(input): masked values only in .masked.json, nothing else there;
// non-master values survive; a master value's knowledge never gets stricter.

import { isDeepStrictEqual } from 'node:util';
import { isMaskedFilePath } from '../bundle/bundle.ts';
import { KNOWLEDGE_LEVELS, isKnowledge } from '../domain/knowledge.ts';
import { findValueNodes, isJsonObject, pointerToFieldPath, type JsonObject } from '../domain/value-node.ts';
import type { MasterImportInput } from '../import/masters/plan-master-import.ts';
import type { FileChange } from '../import/plan/file-change.ts';

interface KeyedValue {
  readonly key: string;
  readonly node: JsonObject;
}

function entityValues(files: ReadonlyMap<string, unknown>, paths: ReadonlySet<string>): KeyedValue[] {
  const values: KeyedValue[] = [];
  for (const path of paths) {
    const document = files.get(path);
    if (!isJsonObject(document) || typeof document.id !== 'string') continue;
    for (const { node, pointer } of findValueNodes(document)) values.push({ key: `${document.id}.${pointerToFieldPath(pointer)}`, node });
  }
  return values;
}

function sourceKind(node: JsonObject): unknown {
  return isJsonObject(node.source) ? node.source.kind : undefined;
}

export default {
  post: (changes: readonly FileChange[], input: MasterImportInput) => {
    for (const { path, after } of changes) {
      if (after === undefined) continue;
      const masked = isMaskedFilePath(path);
      for (const { node } of findValueNodes(after)) {
        if ((node.knowledge === 'masked') !== masked) return `${path} holds a value with knowledge ${String(node.knowledge)}`;
      }
    }
    // Compare the touched entities before and after, across their public and masked files.
    const touched = new Set(changes.flatMap(({ path }) => [path.replace(/\.masked\.json$/, '.json'), path.replace(/(?<!\.masked)\.json$/, '.masked.json')]));
    const result = new Map(input.existing);
    for (const { path, after } of changes) {
      if (after === undefined) result.delete(path);
      else result.set(path, after);
    }
    const afterValues = entityValues(result, touched);
    for (const { key, node } of entityValues(input.existing, touched)) {
      const same = afterValues.filter((value) => value.key === key);
      if (sourceKind(node) !== 'master') {
        if (!same.some((value) => isDeepStrictEqual(value.node, node))) return `${key} (${String(sourceKind(node))}) was not preserved`;
      } else if (isKnowledge(node.knowledge)) {
        const limit = KNOWLEDGE_LEVELS.indexOf(node.knowledge);
        const stricter = same.find((value) => isKnowledge(value.node.knowledge) && KNOWLEDGE_LEVELS.indexOf(value.node.knowledge) > limit);
        if (stricter !== undefined) return `${key} went from ${node.knowledge} to ${String(stricter.node.knowledge)}`;
      }
    }
    return true;
  },
};
