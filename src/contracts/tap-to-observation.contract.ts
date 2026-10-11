// C-74 tapToObservation(frame, context): the observation is a player render-tap frame; every
// observed instance is drawn in the frame's scene pass with a passed occlusion query (or is not
// observed at all); no renderer asset ID (mesh / material of any draw) appears anywhere in it.

import type { TapContext } from '../adapters/render-tap/tap-to-observation.ts';
import type { TapFrame } from '../render-tap/render-frame.ts';
import type { ObservationFrame } from '@ludiars/commentarii-sdk/types';

export default {
  post: (observation: ObservationFrame, frame: TapFrame, _context: TapContext) => {
    if (observation.source !== 'render-tap' || observation.mode !== 'player') return 'not a player render-tap observation';
    const visible = new Set(frame.passes.filter((pass) => pass.kind === 'scene').flatMap((pass) => pass.draws.filter((draw) => draw.visibility === 'occlusion-passed' && (draw.alpha ?? 1) > 0).map((draw) => draw.instance)));
    for (const entity of observation.entities) if (!visible.has(entity.instance)) return `instance ${entity.instance} is observed without a visible scene draw`;
    const text = JSON.stringify(observation);
    const assets = new Set(frame.passes.flatMap((pass) => pass.draws.flatMap((draw) => [draw.mesh, ...draw.material])));
    for (const asset of assets) if (asset.length > 2 && text.includes(JSON.stringify(asset))) return `asset ID ${asset} leaked into the observation`;
    return true;
  },
};
