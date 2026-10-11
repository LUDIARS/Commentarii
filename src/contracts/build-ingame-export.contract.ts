// C-77 buildIngameExport(load, unlocked): no value of a masked companion file reaches the in-game
// export, and every encyclopedia stat is shown in the bundle or discoverable and unlocked.

import type { LoadResult } from '@ludiars/commentarii-sdk/types';
import type { IngameExport } from '../export/build-ingame-export.ts';

export default {
  post: (result: IngameExport, load: LoadResult, unlocked: ReadonlySet<string>) => {
    const masked = new Map(load.bundle.maskedEntities.map(({ doc }) => [doc.id, Object.keys((doc as { stats?: object }).stats ?? {})]));
    const entities = new Map(load.bundle.entities.map(({ doc }) => [doc.id, doc]));
    for (const entry of result.encyclopedia) {
      for (const key of Object.keys(entry.stats)) {
        if ((masked.get(entry.id) ?? []).includes(key)) return `${entry.id}.stats.${key} is masked`;
        const node = (entities.get(entry.id)?.stats as Record<string, { knowledge?: string }> | undefined)?.[key];
        const ok = node?.knowledge === 'shown' || (node?.knowledge === 'discoverable' && unlocked.has(`${entry.id}.stats.${key}`));
        if (!ok) return `${entry.id}.stats.${key} is neither shown nor unlocked`;
      }
    }
    return true;
  },
};
