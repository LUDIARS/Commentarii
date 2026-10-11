// The maker channel for render tap appearances (spec/feature/render-tap-contract.md §6): what the
// player camera visibly drew that the guide cannot name. Asset IDs never enter a player observation
// (C-74), so the engine only ever sees "an unknown instance"; this report is the separate route by
// which the game's maker learns which meshes / materials to give a render_signature (or to tap with
// asset names instead of count hashes). It is read from recorded frames, after the fact.

import { classifyDraw } from './classify-draw.ts';
import { appearanceKey, identifyAppearance } from './identify-appearance.ts';
import { PLAYER_OBSERVER } from './select-player-draws.ts';
import type { TapFrame } from './render-frame.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:b7347bab */
import augurContract_d8a2bdcc from '../contracts/collect-unknown-signatures.contract.ts'; /* augur-inject:contract-predicate:d4386303 */

export type UnknownKind = 'unknown-signature' | 'ambiguous' | 'unidentifiable';

export interface UnknownAppearance {
  readonly kind: UnknownKind;
  readonly mesh: string;
  readonly material: readonly string[];
  /** Entities sharing the appearance (ambiguous only). */
  readonly candidates?: readonly string[];
  /** Frames the appearance was visibly drawn in. */
  readonly frames: number;
  readonly first_frame: number;
  /** Most instances of it drawn in one frame. */
  readonly max_instances: number;
}

export interface UnknownSignatureReport {
  readonly frames_read: number;
  readonly appearances: readonly UnknownAppearance[];
}

interface Tally {
  kind: UnknownKind;
  mesh: string;
  material: readonly string[];
  candidates?: readonly string[];
  frames: number;
  first_frame: number;
  max_instances: number;
}

export function collectUnknownSignatures(frames: readonly TapFrame[], signatures: ReadonlyMap<string, readonly string[]>): UnknownSignatureReport {
  const tallies = new Map<string, Tally>();
  let read = 0;
  for (const frame of frames) {
    if (frame.observer.id !== PLAYER_OBSERVER) continue;
    read += 1;
    const inFrame = new Map<string, number>();
    for (const pass of frame.passes) {
      if (pass.kind !== 'scene') continue;
      for (const draw of pass.draws) {
        if (classifyDraw(draw, pass, frame).verdict !== 'visible') continue;
        const match = identifyAppearance(draw, signatures);
        if (match.kind === 'entity') continue;
        const material = [...draw.material].sort();
        const key = `${match.kind}|${appearanceKey(draw.mesh, material)}`;
        inFrame.set(key, (inFrame.get(key) ?? 0) + 1);
        if (!tallies.has(key)) {
          const candidates = match.kind === 'ambiguous' ? signatures.get(appearanceKey(draw.mesh, draw.material)) : undefined;
          tallies.set(key, { kind: match.kind, mesh: draw.mesh, material, ...(candidates === undefined ? {} : { candidates: [...candidates].sort() }), frames: 0, first_frame: frame.frame, max_instances: 0 });
        }
      }
    }
    for (const [key, count] of inFrame) {
      const tally = tallies.get(key);
      if (tally === undefined) continue;
      tally.frames += 1;
      tally.max_instances = Math.max(tally.max_instances, count);
    }
  }
  const appearances = [...tallies.values()].sort((a, b) => b.frames - a.frames || a.first_frame - b.first_frame || a.mesh.localeCompare(b.mesh));
  return { frames_read: read, appearances };
}
// @ts-expect-error augur-inject
collectUnknownSignatures = contract(collectUnknownSignatures, { ...augurContract_d8a2bdcc, contractId: 'C-80', mode: 'observe', sample: 1, where: 'src/render-tap/collect-unknown-signatures.ts:42', rule: 'contract-wrap', id: 'd8a2bdcc' }); /* augur-inject:contract-wrap:d8a2bdcc */
