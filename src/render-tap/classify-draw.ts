// Whether one tapped draw reached the observer's screen (spec/feature/render-tap-contract.md §4).
// Submitted is not seen: a draw behind a wall, fully transparent, clipped out of its UI panel,
// off the viewport or in a shadow / reflection / depth pass was submitted but not shown.
//   visible   positive evidence it is on screen (scene: occlusion query passed; ui: on screen,
//             opaque, inside its clip, not tagged hidden)
//   excluded  evidence it is not seen
//   unknown   no proof either way (frustum-only, no evidence): never becomes an observation
// Exact visibility is not promised: occlusion evidence may lag (visibility_lag_frames) because
// the tap never stalls the GPU to read it back.

import type { Rect, TapDraw, TapFrame, TapPass } from './render-frame.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:160a3343 */
import augurContract_fa245e5a from '../contracts/classify-draw.contract.ts'; /* augur-inject:contract-predicate:7bbd606e */

export type DrawVerdict = 'visible' | 'excluded' | 'unknown';

export type DrawReason =
  | 'pass-not-visible'
  | 'occluded'
  | 'no-occlusion-evidence'
  | 'transparent'
  | 'off-viewport'
  | 'clipped'
  | 'hidden-ui'
  | 'shown';

export interface DrawClassification {
  readonly verdict: DrawVerdict;
  readonly reason: DrawReason;
}

/** Pass kinds whose draws can be on the observer's screen. */
const OBSERVABLE_PASSES = new Set(['scene', 'ui']);

function overlaps(a: Rect, b: Rect): boolean {
  return a[2] > 0 && a[3] > 0 && b[2] > 0 && b[3] > 0 && a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

function outcome(verdict: DrawVerdict, reason: DrawReason): DrawClassification {
  return { verdict, reason };
}

export function classifyDraw(draw: TapDraw, pass: TapPass, frame: TapFrame): DrawClassification {
  if (!OBSERVABLE_PASSES.has(pass.kind)) return outcome('excluded', 'pass-not-visible');
  if ((draw.alpha ?? 1) <= 0) return outcome('excluded', 'transparent');
  const viewport: Rect = [0, 0, frame.observer.viewport[0], frame.observer.viewport[1]];
  if (!overlaps(draw.screen_bbox, viewport)) return outcome('excluded', 'off-viewport');
  if (pass.kind === 'ui') {
    if (draw.tags?.includes('hidden') === true) return outcome('excluded', 'hidden-ui');
    if (draw.clip !== undefined && !overlaps(draw.screen_bbox, draw.clip)) return outcome('excluded', 'clipped');
    return outcome('visible', 'shown');
  }
  if (draw.visibility === 'occlusion-failed') return outcome('excluded', 'occluded');
  if (draw.visibility === 'occlusion-passed') return outcome('visible', 'shown');
  return outcome('unknown', 'no-occlusion-evidence');
}
// @ts-expect-error augur-inject
classifyDraw = contract(classifyDraw, { ...augurContract_fa245e5a, contractId: 'C-61', mode: 'observe', sample: 1, where: 'src/render-tap/classify-draw.ts:41', rule: 'contract-wrap', id: 'fa245e5a' }); /* augur-inject:contract-wrap:fa245e5a */
