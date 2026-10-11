// The separation between the raw tap and the player observation (spec/feature/render-tap-contract.md §4-5):
// from one tapped frame, only draws the player's camera showed, with the identity the player can
// tell from appearance, go on. Everything else is counted, never forwarded. The receiver builds
// Observation frames (design 7.2, source render-tap) from this result alone, so asset IDs,
// occluded or transparent objects, shadow and reflection passes and hidden UI cannot leak.

import { classifyDraw, type DrawReason } from './classify-draw.ts';
import { identifyAppearance, type AppearanceMatch } from './identify-appearance.ts';
import type { Rect, TapFrame, UiSemantics } from './render-frame.ts';
import { worldPosition } from './render-frame.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:fb5add52 */
import augurContract_45d22404 from '../contracts/select-player-draws.contract.ts'; /* augur-inject:contract-predicate:71dfaa72 */

/** The observer whose frames may become player observations. */
export const PLAYER_OBSERVER = 'player-camera';

export interface SeenInstance {
  readonly instance: number;
  /** Only when the appearance names exactly one entity. */
  readonly entity?: string;
  readonly identity: AppearanceMatch['kind'];
  readonly pos: readonly [number, number, number];
  readonly screen: Rect;
}

export interface SeenUi {
  readonly ui: UiSemantics;
  readonly screen: Rect;
}

export interface PlayerDraws {
  readonly seen: readonly SeenInstance[];
  readonly ui: readonly SeenUi[];
  /** Draws left out, by why (never forwarded). */
  readonly excluded: Readonly<Partial<Record<DrawReason, number>>>;
  /** Draws without proof either way (left out). */
  readonly unknown: number;
  /** The tap dropped draws in this frame: an instance missing here may still be there. */
  readonly incomplete: boolean;
}

export class ObserverError extends Error {
  override readonly name = 'ObserverError';
}

export function selectPlayerDraws(frame: TapFrame, signatures: ReadonlyMap<string, readonly string[]>): PlayerDraws {
  if (frame.observer.id !== PLAYER_OBSERVER) throw new ObserverError(`frame ${frame.frame} is rendered for ${frame.observer.id}, not ${PLAYER_OBSERVER}`);
  const seen: SeenInstance[] = [];
  const ui: SeenUi[] = [];
  const excluded: Partial<Record<DrawReason, number>> = {};
  let unknown = 0;
  for (const pass of frame.passes) {
    for (const draw of pass.draws) {
      const { verdict, reason } = classifyDraw(draw, pass, frame);
      if (verdict === 'unknown') unknown += 1;
      else if (verdict === 'excluded') excluded[reason] = (excluded[reason] ?? 0) + 1;
      else if (pass.kind === 'ui') {
        if (draw.ui !== undefined) ui.push({ ui: draw.ui, screen: draw.screen_bbox });
      } else {
        const match = identifyAppearance(draw, signatures);
        seen.push({ instance: draw.instance, ...(match.kind === 'entity' ? { entity: match.entity } : {}), identity: match.kind, pos: worldPosition(draw), screen: draw.screen_bbox });
      }
    }
  }
  return { seen, ui, excluded, unknown, incomplete: frame.dropped !== undefined };
}
// @ts-expect-error augur-inject
selectPlayerDraws = contract(selectPlayerDraws, { ...augurContract_45d22404, contractId: 'C-63', mode: 'observe', sample: 1, where: 'src/render-tap/select-player-draws.ts:44', rule: 'contract-wrap', id: '45d22404' }); /* augur-inject:contract-wrap:45d22404 */
