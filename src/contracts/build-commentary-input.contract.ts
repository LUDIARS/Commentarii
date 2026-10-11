// C-79 buildCommentaryInput(run, bundle): only a player-mode run is read, and no tactic the player
// view leaves out (masked) appears anywhere in the input handed to a narrator.

import type { Bundle } from '../bundle/bundle.ts';
import { toPlayerView } from '../bundle/player-view.ts';
import type { CommentaryInput } from '../commentary/commentary-input.ts';
import type { ReplayRun } from '../replay/replay-record.ts';

export default {
  post: (result: CommentaryInput, run: ReplayRun, bundle: Bundle) => {
    if (run.header.mode !== 'player') return `read a ${run.header.mode} run`;
    const known = new Set(toPlayerView(bundle).tactics.map(({ doc }) => doc.id));
    const text = JSON.stringify(result);
    for (const { doc } of bundle.tactics) if (!known.has(doc.id) && text.includes(doc.id)) return `${doc.id} is not player knowledge but reached the input`;
    return true;
  },
};
