// C-33 applyOverlay(bundle, persona, overlay): every tactic measured in the overlay runs with
// the overlay's metrics, the input bundle and persona are not modified (changed tactics are
// copies), and each persona weight is the input weight times the overlay factor (or as it was).

import { isDeepStrictEqual } from 'node:util';
import type { Bundle } from '../bundle/bundle.ts';
import { CONSIDERATION_NAMES, type Persona } from '../engine/persona/persona.ts';
import type { OverlaidSetup } from '../learn/overlay/apply-overlay.ts';
import type { Overlay } from '../learn/overlay/overlay.ts';

export default {
  post: (result: OverlaidSetup, bundle: Bundle, persona: Persona, overlay: Overlay) => {
    if (result.bundle === bundle || result.persona === persona) return 'the input setup was returned as the overlaid one';
    const output = new Map(result.bundle.tactics.map(({ doc }) => [doc.id, doc]));
    for (const entry of overlay.tactics) {
      if (entry.variant !== undefined || entry.metrics.runs === 0) continue;
      const input = bundle.tactics.find(({ doc }) => doc.id === entry.tactic)?.doc;
      if (input === undefined) continue;
      if (!isDeepStrictEqual(output.get(entry.tactic)?.metrics, entry.metrics)) return `${entry.tactic} does not run with its measured metrics`;
      if (output.get(entry.tactic) === input && !isDeepStrictEqual(input.metrics, entry.metrics)) return `${entry.tactic} was modified in place`;
    }
    for (const name of CONSIDERATION_NAMES) {
      const expected = persona.weights[name] * (overlay.weights[name] ?? 1);
      if (Math.abs(result.persona.weights[name] - expected) > 1e-9) return `weight ${name} is not the input weight times the overlay factor`;
    }
    return true;
  },
};
