// C-61 classifyDraw(draw, pass, frame): a draw is visible only in a scene or ui pass, with alpha
// above 0, a bounding box on the viewport, and (scene) an occlusion query that passed or (ui)
// no hidden tag and a box inside its clip; shadow / reflection / depth / post passes are never
// visible; a scene draw without occlusion evidence is never visible.

import type { DrawClassification } from '../render-tap/classify-draw.ts';
import type { TapDraw, TapFrame, TapPass } from '../render-tap/render-frame.ts';

export default {
  post: (result: DrawClassification, draw: TapDraw, pass: TapPass, frame: TapFrame) => {
    if (result.verdict !== 'visible') return true;
    if (pass.kind !== 'scene' && pass.kind !== 'ui') return `a ${pass.kind} pass draw is visible`;
    if ((draw.alpha ?? 1) <= 0) return 'a transparent draw is visible';
    const [x, y, w, h] = draw.screen_bbox;
    const [vw, vh] = frame.observer.viewport;
    if (w <= 0 || h <= 0 || x >= vw || y >= vh || x + w <= 0 || y + h <= 0) return 'an off-viewport draw is visible';
    if (pass.kind === 'scene' && draw.visibility !== 'occlusion-passed') return `a scene draw with ${draw.visibility} evidence is visible`;
    if (pass.kind === 'ui' && draw.tags?.includes('hidden') === true) return 'a hidden UI draw is visible';
    return true;
  },
};
