// Appearance -> guide entity (spec/feature/render-tap-contract.md §5). The player recognizes a
// thing by how it looks, so a draw names an entity only when its appearance (mesh + materials)
// belongs to exactly one entity of the bundle's render_signature index:
//   - two entities that look the same (same signature) are ambiguous: naming one would leak
//     what the player cannot tell apart;
//   - a count-hash identity (vertex + index counts) collides between unrelated meshes and
//     never identifies anything;
//   - no match is an unknown signature (reflect drafts an entity from it, design 7.1).
// The renderer's asset IDs never go further than this function: an Observation carries the
// entity ID or nothing.

import type { TapDraw } from './render-frame.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:469acb3a */
import augurContract_8aca2c86 from '../contracts/identify-appearance.contract.ts'; /* augur-inject:contract-predicate:12b874be */

export type AppearanceMatch =
  | { readonly kind: 'entity'; readonly entity: string }
  | { readonly kind: 'ambiguous'; readonly candidates: number }
  | { readonly kind: 'unidentifiable' }
  | { readonly kind: 'unknown-signature' };

export interface SignatureEntry {
  readonly entity: string;
  readonly mesh?: string;
  readonly material?: readonly string[];
}

export function appearanceKey(mesh: string | undefined, material: readonly string[] | undefined): string {
  return `${mesh ?? ''}|${[...(material ?? [])].sort().join(',')}`;
}

/** Signature key -> the entity IDs drawn that way (from entity render_signature). */
export function buildSignatureIndex(entries: readonly SignatureEntry[]): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  for (const entry of entries) {
    const key = appearanceKey(entry.mesh, entry.material);
    const entities = index.get(key) ?? [];
    if (!entities.includes(entry.entity)) entities.push(entry.entity);
    index.set(key, entities);
  }
  return index;
}

export function identifyAppearance(draw: TapDraw, index: ReadonlyMap<string, readonly string[]>): AppearanceMatch {
  if (draw.identity === 'count-hash') return { kind: 'unidentifiable' };
  const entities = index.get(appearanceKey(draw.mesh, draw.material)) ?? [];
  const [only] = entities;
  if (entities.length === 1 && only !== undefined) return { kind: 'entity', entity: only };
  if (entities.length > 1) return { kind: 'ambiguous', candidates: entities.length };
  return { kind: 'unknown-signature' };
}
// @ts-expect-error augur-inject
identifyAppearance = contract(identifyAppearance, { ...augurContract_8aca2c86, contractId: 'C-62', mode: 'observe', sample: 1, where: 'src/render-tap/identify-appearance.ts:42', rule: 'contract-wrap', id: '8aca2c86' }); /* augur-inject:contract-wrap:8aca2c86 */
