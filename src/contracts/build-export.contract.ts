// C-17 buildExport(load, options): a player export holds no masked value anywhere and no
// masked companion files; every index entry points at the document with that ID.

import type { LoadResult } from '../bundle/bundle.ts';
import type { ExportOptions } from '../export/build-export.ts';
import type { ExportedBundle } from '../export/exported-bundle.ts';

function containsMasked(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsMasked);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.knowledge === 'masked') return true;
  return Object.values(record).some(containsMasked);
}

function resolvePointer(root: unknown, pointer: string): unknown {
  let current = root;
  for (const segment of pointer.split('/').slice(1)) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  return current;
}

function idAt(exported: ExportedBundle, pointer: string): unknown {
  const target = resolvePointer(exported, pointer) as { doc?: { id?: unknown }; id?: unknown } | undefined;
  return target?.doc?.id ?? target?.id;
}

export default {
  post: (exported: ExportedBundle, _load: LoadResult, options: ExportOptions) => {
    if (exported.knowledge !== options.knowledge) return 'export reports another knowledge level';
    if (options.knowledge === 'player') {
      if (exported.documents.masked_entities.length > 0) return 'player export keeps masked companion files';
      if (containsMasked(exported)) return 'player export contains a masked value';
    }
    for (const [id, entry] of Object.entries(exported.index.ids)) {
      if (idAt(exported, entry.pointer) !== id) return `index entry ${id} does not point at its document`;
    }
    return true;
  },
};
