// C-5 renderBundle(load, options): player output never shows masked names or values, nor what
// only a masked action override says.

import type { LoadResult } from '@ludiars/commentarii-sdk/types';
import type { RenderOptions } from '../render/render-bundle.ts';

/** Field names and string values that exist only in masked companion files. */
function maskedMarkers(load: LoadResult): string[] {
  const publicStats = new Set(load.bundle.entities.flatMap(({ doc }) => Object.keys(doc.stats ?? {})));
  const markers: string[] = [];
  for (const { doc } of load.bundle.maskedEntities) {
    for (const name of Object.keys(doc.stats ?? {})) if (!publicStats.has(name)) markers.push(name);
    for (const [name, value] of Object.entries(doc.fields ?? {})) {
      markers.push(name);
      if (typeof value.value === 'string') markers.push(value.value);
    }
  }
  const visible = new Map(load.bundle.rulebook.actions.map(({ doc }) => [doc.id, new Set(strings(doc))]));
  for (const { doc } of load.bundle.rulebook.maskedActions) {
    const seen = visible.get(doc.id) ?? new Set<string>();
    for (const text of [...strings(doc.override), doc.source.ref]) if (!seen.has(text)) markers.push(text);
  }
  return markers;
}

/** Every string leaf of a JSON value. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

export default {
  post: (files: ReadonlyMap<string, string>, load: LoadResult, options: RenderOptions) => {
    if (options.knowledge === 'full') return files.has('masked.md') || 'full render has no masked.md';
    if (files.has('masked.md')) return 'player render writes masked.md';
    const markers = maskedMarkers(load);
    for (const [path, text] of files) {
      if (markers.some((marker) => text.includes(marker))) return `${path} shows a masked value`;
    }
    return true;
  },
};
