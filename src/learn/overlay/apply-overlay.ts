// What the engine takes from the overlay at start-up (design 8.1, 8.2), in memory only: the
// canonical bundle is never written and the input objects are never mutated.
//   - a tactic measured in player runs gets its overlay metrics instead of the bundle's;
//   - each rewrite candidate joins the tactics as the learned tactic it is (used from the next
//     play on; personas that trust only authored tactics still ignore it);
//   - the persona's consideration weights are scaled by the overlay's factors.

import type { Bundle, Located } from '../../bundle/bundle.ts';
import type { Tactic } from '../../domain/documents.ts';
import { CONSIDERATION_NAMES, type Persona } from '../../engine/persona/persona.ts';
import { OVERLAY_PATH, type Overlay } from './overlay.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:13e7c4fb */
import augurContract_016a4940 from '../../contracts/apply-overlay.contract.ts'; /* augur-inject:contract-predicate:8b65e6b9 */

export interface OverlaidSetup {
  readonly bundle: Bundle;
  readonly persona: Persona;
}

function measuredTactics(bundle: Bundle, overlay: Overlay): Located<Tactic>[] {
  const measured = new Map(overlay.tactics.filter((entry) => entry.variant === undefined && entry.metrics.runs > 0).map((entry) => [entry.tactic, entry.metrics]));
  return bundle.tactics.map((located) => {
    const metrics = measured.get(located.doc.id);
    return metrics === undefined ? located : { path: located.path, doc: { ...located.doc, metrics } };
  });
}

function rewriteTactics(bundle: Bundle, overlay: Overlay): Located<Tactic>[] {
  const known = new Set(bundle.tactics.map(({ doc }) => doc.id));
  return overlay.rewrites
    .map((rewrite, index) => ({ path: `${OVERLAY_PATH}#/rewrites/${index}`, doc: rewrite.tactic }))
    .filter(({ doc }) => !known.has(doc.id));
}

function scaledPersona(persona: Persona, overlay: Overlay): Persona {
  const weights = { ...persona.weights };
  for (const name of CONSIDERATION_NAMES) {
    const factor = overlay.weights[name];
    if (factor !== undefined) weights[name] = persona.weights[name] * factor;
  }
  return { ...persona, weights };
}

export function applyOverlay(bundle: Bundle, persona: Persona, overlay: Overlay): OverlaidSetup {
  return {
    bundle: { ...bundle, tactics: [...measuredTactics(bundle, overlay), ...rewriteTactics(bundle, overlay)] },
    persona: scaledPersona(persona, overlay),
  };
}
// @ts-expect-error augur-inject
applyOverlay = contract(applyOverlay, { ...augurContract_016a4940, contractId: 'C-33', mode: 'observe', sample: 1, where: 'src/learn/overlay/apply-overlay.ts:42', rule: 'contract-wrap', id: '016a4940' }); /* augur-inject:contract-wrap:016a4940 */
