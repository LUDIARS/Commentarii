// C-5 renderBundle(load, options): player output never shows masked names or values.

import type { LoadResult } from '../bundle/bundle.ts';
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
  return markers;
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
