// unknown-entity lines (design 7.5 "未知は記録"): an observed entity the guide does not
// describe, once per run and kind of unknown, as the material for a draft entity:
//   - identified but absent from the guide: keyed by its entity ID;
//   - unidentified (no entity ID): keyed by its render signature, which render-tap adapters
//     report in extra.signatures (instance -> { mesh, sprite, material }), else 'unidentified'.

import { parseRef } from '../../domain/id.ts';
import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservationFrame, ObservedEntity } from '../../replay/observation-frame.ts';
import { lineOf, type OverlayLine } from './overlay-line.ts';
import type { ReflectWorld } from './reflect-world.ts';

export interface RenderSignature {
  readonly mesh?: string;
  readonly sprite?: string;
  readonly material?: readonly string[];
}

const UNIDENTIFIED = 'unidentified';

function isPlainId(text: unknown): text is string {
  return typeof text === 'string' && parseRef(text)?.base === text;
}

/** extra.signatures[instance], keeping only well-formed IDs (the guide's render_signature grammar). */
export function signatureOf(frame: ObservationFrame, instance: number): RenderSignature | undefined {
  const table = frame.extra?.signatures;
  const raw = isJsonObject(table) ? table[String(instance)] : undefined;
  if (!isJsonObject(raw)) return undefined;
  const material = Array.isArray(raw.material) ? raw.material.filter(isPlainId) : [];
  const signature: RenderSignature = {
    ...(isPlainId(raw.mesh) ? { mesh: raw.mesh } : {}),
    ...(isPlainId(raw.sprite) ? { sprite: raw.sprite } : {}),
    ...(material.length > 0 ? { material } : {}),
  };
  return Object.keys(signature).length > 0 ? signature : undefined;
}

function unknownKey(entity: ObservedEntity, signature: RenderSignature | undefined): string {
  if (entity.entity !== undefined) return entity.entity;
  return signature === undefined ? UNIDENTIFIED : `signature:${JSON.stringify(signature)}`;
}

function unknownLine(frame: ObservationFrame, entity: ObservedEntity, signature: RenderSignature | undefined): OverlayLine {
  const observed = {
    instance: entity.instance,
    ...(signature === undefined ? {} : { signature }),
    ...(entity.state_guess === undefined ? {} : { state_guess: entity.state_guess }),
  };
  return { ...lineOf(frame, 'unknown-entity'), ...(entity.entity === undefined ? {} : { entity: entity.entity }), observed };
}

/** Lines for unknowns not reported yet in this run, and the keys reported so far. */
export function unknownEntityLines(
  frame: ObservationFrame,
  world: ReflectWorld,
  reported: ReadonlySet<string>,
): { readonly lines: OverlayLine[]; readonly reported: ReadonlySet<string> } {
  const lines: OverlayLine[] = [];
  const keys = new Set(reported);
  for (const entity of frame.entities) {
    if (entity.entity !== undefined && world.knownEntities.has(entity.entity)) continue;
    const signature = entity.entity === undefined ? signatureOf(frame, entity.instance) : undefined;
    const key = unknownKey(entity, signature);
    if (keys.has(key)) continue;
    keys.add(key);
    lines.push(unknownLine(frame, entity, signature));
  }
  return { lines, reported: lines.length === 0 ? reported : keys };
}
