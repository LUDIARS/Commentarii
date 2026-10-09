// Input of guide import map after parsing: the source map in one of three shapes, plus the
// stage and the manifest coordinates it has to agree with.

import type { AnnotationKind, LocalizedText, Manifest } from '../../domain/documents.ts';
import type { Knowledge } from '../../domain/knowledge.ts';
import type { GridMapping } from '../mapping.ts';

export type Coordinates = Manifest['coordinates'];

/** Grid cells by row (y) then column (x); each cell is a legend key. */
export type CellMatrix = readonly (readonly string[])[];

export interface InputEdge {
  readonly from: string;
  readonly to: string;
  readonly directed?: boolean;
  readonly cost?: number;
  readonly knowledge?: Knowledge;
}

export interface InputAnnotation {
  readonly target: string;
  readonly kind: AnnotationKind;
  readonly ref?: string;
  readonly note?: LocalizedText;
  readonly knowledge?: Knowledge;
}

/** schema/import-navgraph.schema.json */
export interface NavgraphInput {
  readonly coordinates?: Coordinates;
  readonly nodes: readonly { readonly id: string; readonly pos: readonly number[]; readonly label?: LocalizedText; readonly knowledge?: Knowledge }[];
  readonly edges: readonly InputEdge[];
  readonly annotations?: readonly InputAnnotation[];
}

export interface InputZone {
  readonly id: string;
  readonly label?: LocalizedText;
  readonly knowledge?: Knowledge;
  readonly polygon?: readonly (readonly number[])[];
  readonly rect?: { readonly min: readonly number[]; readonly max: readonly number[] };
}

/** schema/import-zones.schema.json */
export interface ZonesInput {
  readonly coordinates?: Coordinates;
  readonly zones: readonly InputZone[];
  readonly adjacency: readonly InputEdge[];
  readonly annotations?: readonly InputAnnotation[];
}

interface MapRequestBase {
  readonly stageId: string;
  /** File name of the source map, written to source.ref. */
  readonly sourceName: string;
  readonly coordinates: Coordinates;
}

export type MapImportRequest =
  | (MapRequestBase & { readonly kind: 'grid'; readonly cells: CellMatrix; readonly grid: GridMapping; readonly neighbors: 4 | 8 })
  | (MapRequestBase & { readonly kind: 'navgraph'; readonly input: NavgraphInput })
  | (MapRequestBase & { readonly kind: 'zones'; readonly input: ZonesInput });
