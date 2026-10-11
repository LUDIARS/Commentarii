// How a game's render tap maps to the player observation (manifest render_tap,
// spec/feature/render-tap-contract.md §8): which drawn appearance is the player's own avatar
// (self.pos) and which UI element shows which observation place. A UI value may only go to
// self.hp or to a place the game declared in observation.fields (the boundary check refuses
// anything else, so a mapping cannot smuggle a value past it).

import type { Manifest } from '@ludiars/commentarii-sdk/types';

export type UiRead = 'fill' | 'number';

export interface UiMapping {
  readonly element: string;
  readonly read: UiRead;
  /** self.hp, or a declared observation path (extra.<key>, self.resources.<name>). */
  readonly path: string;
}

export interface RenderTapConfig {
  readonly self?: { readonly mesh: string; readonly material?: readonly string[] };
  readonly ui: readonly UiMapping[];
}

export function renderTapConfigOf(manifest: Manifest | undefined): RenderTapConfig {
  const declared = manifest?.render_tap;
  return { ...(declared?.self === undefined ? {} : { self: declared.self }), ui: declared?.ui ?? [] };
}
