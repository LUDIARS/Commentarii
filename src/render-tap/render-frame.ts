// Lines of the render tap stream, contract render-tap/1 (spec/feature/render-tap-contract.md,
// schema/render-frame.schema.json). A raw tap frame is what the renderer submitted, not what the
// player saw: select-player-draws.ts decides which draws may become a player observation.

export const RENDER_TAP_CONTRACT = 'render-tap/1';

/** 4x4, column-major (12..14 = translation), right-handed, Y up, manifest coordinates.unit. */
export type Matrix4 = readonly number[];
/** [x, y, width, height] in viewport pixels, origin top-left, y down. */
export type Rect = readonly [number, number, number, number];

export type PassKind = 'scene' | 'ui' | 'shadow' | 'reflection' | 'depth-prepass' | 'postprocess' | 'other';
export type DrawIdentity = 'asset-name' | 'content-hash' | 'count-hash';
export type VisibilityEvidence = 'occlusion-passed' | 'occlusion-failed' | 'frustum-only' | 'unknown';

export type UiSemantics =
  | { readonly role: 'bar'; readonly element?: string; readonly fill: number }
  | { readonly role: 'glyph'; readonly element?: string; readonly glyph: string };

export interface TapDraw {
  readonly mesh: string;
  readonly material: readonly string[];
  readonly identity: DrawIdentity;
  readonly instance: number;
  readonly generation: number;
  readonly world: Matrix4;
  readonly screen_bbox: Rect;
  readonly depth_order: number;
  readonly visibility: VisibilityEvidence;
  readonly alpha?: number;
  readonly clip?: Rect;
  readonly ui?: UiSemantics;
  readonly tags?: readonly string[];
}

export interface TapPass {
  readonly name: string;
  readonly kind: PassKind;
  readonly draws: readonly TapDraw[];
}

export interface TapFrame {
  readonly contract: typeof RENDER_TAP_CONTRACT;
  readonly seq: number;
  readonly frame: number;
  readonly tick?: number;
  readonly t: number;
  readonly observer: { readonly id: string; readonly viewport: readonly [number, number] };
  readonly camera: { readonly view: Matrix4; readonly projection: Matrix4 };
  readonly visibility_lag_frames?: number;
  readonly passes: readonly TapPass[];
  readonly dropped?: { readonly draws: number; readonly reason: 'backpressure' | 'buffer-full' | 'other' };
}

export interface TapEnd {
  readonly contract: typeof RENDER_TAP_CONTRACT;
  readonly seq: number;
  readonly end: 'shutdown' | 'error';
}

export type TapLine = TapFrame | TapEnd;

export function isTapEnd(line: TapLine): line is TapEnd {
  return 'end' in line;
}

/** World position of a draw: the translation column of its column-major world matrix. */
export function worldPosition(draw: TapDraw): readonly [number, number, number] {
  return [draw.world[12] ?? 0, draw.world[13] ?? 0, draw.world[14] ?? 0];
}
