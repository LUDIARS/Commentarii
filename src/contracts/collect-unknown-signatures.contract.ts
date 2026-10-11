// C-80 collectUnknownSignatures(frames, signatures): every reported appearance is one the guide
// cannot name uniquely (unknown-signature: no entity, ambiguous: two or more), and nothing is
// counted in more frames than the player-camera frames read.

import type { UnknownSignatureReport } from '../render-tap/collect-unknown-signatures.ts';
import { appearanceKey } from '../render-tap/identify-appearance.ts';
import type { TapFrame } from '../render-tap/render-frame.ts';

export default {
  post: (result: UnknownSignatureReport, _frames: readonly TapFrame[], signatures: ReadonlyMap<string, readonly string[]>) => {
    for (const appearance of result.appearances) {
      if (appearance.frames > result.frames_read) return `${appearance.mesh} counted in more frames than were read`;
      const named = signatures.get(appearanceKey(appearance.mesh, appearance.material)) ?? [];
      if (appearance.kind === 'unknown-signature' && named.length > 0) return `${appearance.mesh} is named in the guide but reported unknown`;
      if (appearance.kind === 'ambiguous' && named.length < 2) return `${appearance.mesh} reported ambiguous with ${named.length} candidate(s)`;
    }
    return true;
  },
};
