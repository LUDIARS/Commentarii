// TypeScript view of an import mapping (schema/mapping.schema.json is the source of truth).
// One mapping per game: master tables -> entities, and the character legend of grid maps.

import type { AnnotationKind, LocalizedText } from '../domain/documents.ts';
import type { EntityKind } from '../domain/id.ts';
import type { Knowledge } from '../domain/knowledge.ts';

export interface StatMapping {
  readonly column: string;
  readonly unit?: string;
  /** Initial boundary; left out means masked (principle 1). */
  readonly knowledge?: Knowledge;
}

export type KindMapping = EntityKind | { readonly column: string; readonly values: Readonly<Record<string, EntityKind>> };

export interface RenderSignatureMapping {
  readonly mesh?: string;
  readonly sprite?: string;
  readonly material?: string;
  readonly material_separator?: string;
}

export interface TableMapping {
  readonly kind: KindMapping;
  readonly id: { readonly column: string; readonly slugify?: boolean };
  /** Language -> column. */
  readonly name: Readonly<Record<string, string>>;
  readonly behavior?: string;
  readonly render_signature?: RenderSignatureMapping;
  readonly stats?: Readonly<Record<string, StatMapping>>;
}

export interface GridLegendEntry {
  readonly walkable: boolean;
  readonly annotation?: AnnotationKind;
  readonly note?: LocalizedText;
  readonly knowledge?: Knowledge;
}

export interface GridMapping {
  readonly legend: Readonly<Record<string, GridLegendEntry>>;
  readonly knowledge?: Knowledge;
  readonly unit?: string;
}

export interface Mapping {
  readonly tables?: Readonly<Record<string, TableMapping>>;
  readonly grid?: GridMapping;
}

/** The boundary a value gets when its mapping declares none. */
export const DEFAULT_KNOWLEDGE: Knowledge = 'masked';
