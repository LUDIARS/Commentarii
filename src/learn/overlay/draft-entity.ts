// Template of an entity file for an unknown entity (design 7.1: "埋まらない分は観測で draft
// 雛形を起こす"): identified unknowns keep their ID; unidentified ones get
// enemy:<game>:observed-<8 hex of their key> (an assumption: an unidentified thing on screen is
// treated as an enemy until a person says otherwise). The draft carries only what reflect saw
// (the render signature), is marked draft with an observed source, and is never applied
// automatically (guide learn consolidate proposes it).

import { createHash } from 'node:crypto';
import { ENTITY_GROUP_OF_KIND, isEntityKind, parseRef } from '../../domain/id.ts';
import type { RenderSignature } from '../../engine/reflect/unknown-entities.ts';
import type { EntityDraft } from './overlay.ts';

function shortHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

function draftId(gameId: string, key: string, entity: string | undefined): string {
  return entity ?? `enemy:${gameId}:observed-${shortHash(key)}`;
}

export function draftEntity(
  gameId: string,
  unknown: { readonly key: string; readonly entity?: string; readonly signature?: RenderSignature },
  runs: readonly string[],
  sightings: number,
): EntityDraft {
  const id = draftId(gameId, unknown.key, unknown.entity);
  const ref = parseRef(id);
  const kind = ref !== undefined && isEntityKind(ref.kind) ? ref.kind : 'enemy';
  const slug = ref?.slug ?? `observed-${shortHash(unknown.key)}`;
  return {
    path: `entities/${ENTITY_GROUP_OF_KIND[kind]}/${slug}.json`,
    draft: true,
    source: { kind: 'observed', ref: `${runs.join(' ')} x${sightings}` },
    doc: {
      id,
      name: { en: `Observed ${slug}` },
      ...(unknown.signature === undefined ? {} : { render_signature: unknown.signature }),
    },
  };
}
