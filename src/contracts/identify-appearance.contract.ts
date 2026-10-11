// C-62 identifyAppearance(draw, index): an entity is named only for an asset-name or
// content-hash identity whose appearance maps to exactly that one entity; a count-hash is
// never identified; several entities with the appearance are ambiguous.

import { appearanceKey, type AppearanceMatch } from '../render-tap/identify-appearance.ts';
import type { TapDraw } from '../render-tap/render-frame.ts';

export default {
  post: (match: AppearanceMatch, draw: TapDraw, index: ReadonlyMap<string, readonly string[]>) => {
    const entities = index.get(appearanceKey(draw.mesh, draw.material)) ?? [];
    if (draw.identity === 'count-hash') return match.kind === 'unidentifiable' || 'a count-hash draw was identified';
    if (match.kind === 'entity') return (entities.length === 1 && entities[0] === match.entity) || 'an entity was named without a unique appearance';
    if (entities.length > 1) return match.kind === 'ambiguous' || 'a shared appearance was not reported ambiguous';
    return true;
  },
};
