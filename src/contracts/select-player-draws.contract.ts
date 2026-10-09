// C-63 selectPlayerDraws(frame, signatures): every seen instance comes from a scene draw with a
// passed occlusion query, opaque and on the viewport; a seen instance carries an entity only
// when its appearance is unique; UI readings come from ui-pass draws only; every draw is
// either seen, read as UI, excluded or unknown (none disappears uncounted).

import type { PlayerDraws } from '../render-tap/select-player-draws.ts';
import type { TapFrame } from '../render-tap/render-frame.ts';

export default {
  post: (result: PlayerDraws, frame: TapFrame) => {
    const scene = frame.passes.filter((pass) => pass.kind === 'scene').flatMap((pass) => pass.draws);
    for (const seen of result.seen) {
      const draw = scene.find((candidate) => candidate.instance === seen.instance && candidate.visibility === 'occlusion-passed' && (candidate.alpha ?? 1) > 0);
      if (draw === undefined) return `instance ${seen.instance} is seen without a visible scene draw`;
      if (seen.entity !== undefined && seen.identity !== 'entity') return `instance ${seen.instance} is named while ${seen.identity}`;
    }
    const uiDraws = frame.passes.filter((pass) => pass.kind === 'ui').flatMap((pass) => pass.draws).filter((draw) => draw.ui !== undefined);
    if (result.ui.length > uiDraws.length) return 'more UI readings than UI draws';
    const total = frame.passes.reduce((sum, pass) => sum + pass.draws.length, 0);
    const excluded = Object.values(result.excluded).reduce((sum, count) => sum + (count ?? 0), 0);
    const uiWithout = frame.passes.filter((pass) => pass.kind === 'ui').flatMap((pass) => pass.draws).filter((draw) => draw.ui === undefined).length;
    if (result.seen.length + result.ui.length + excluded + result.unknown > total) return 'more draws accounted for than tapped';
    if (result.seen.length + result.ui.length + excluded + result.unknown + uiWithout < total) return 'a draw disappeared uncounted';
    return true;
  },
};
