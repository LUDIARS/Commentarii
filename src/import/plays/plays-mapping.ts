// TypeScript view of a play log mapping (schema/plays-mapping.schema.json is the source of
// truth): telemetry column -> Observation field, game identifier -> guide ID (design 14.D).

import type { Knowledge } from '../../domain/knowledge.ts';
import type { ActionVerb } from '../../replay/replay-action.ts';
import type { ReplayResult } from '../../replay/replay-record.ts';

export interface ColumnRef {
  readonly column: string;
}

/** One column holding [x, y, z], or three columns. */
export type VectorMapping = string | readonly [string, string, string];

export interface LookupMapping {
  readonly column: string;
  /** Game value -> guide ID. */
  readonly values?: Readonly<Record<string, string>>;
}

export interface ObservedValueMapping {
  readonly column: string;
  /** Left out: masked, which fails the import (principle 2). */
  readonly knowledge?: Knowledge;
}

export interface HpMapping extends ObservedValueMapping {
  readonly max?: number;
  readonly max_column?: string;
}

export interface SelfMapping {
  readonly pos?: VectorMapping;
  readonly hp?: HpMapping;
  readonly resources?: Readonly<Record<string, ObservedValueMapping>>;
}

export interface EntitiesMapping {
  readonly column: string;
  readonly fields: { readonly entity: string; readonly instance: string; readonly pos?: VectorMapping };
}

export interface VerbMapping {
  readonly verb: ActionVerb;
  readonly operand?: string;
  readonly operand_pos?: VectorMapping;
  readonly custom?: string;
  readonly seconds?: number;
}

export interface IdentifyMapping {
  readonly table?: Readonly<Record<string, string>>;
  /** Reuse the ID rule of one table of a guide import masters mapping. */
  readonly masters?: { readonly mapping: string; readonly table: string };
}

export interface PlaysMapping {
  readonly player: ColumnRef;
  readonly run: ColumnRef;
  readonly tick?: ColumnRef;
  readonly t: { readonly column: string; readonly scale?: number };
  readonly started_at?: ColumnRef;
  readonly stage: LookupMapping;
  readonly node?: LookupMapping;
  readonly self?: SelfMapping;
  readonly entities?: EntitiesMapping;
  readonly events?: { readonly column: string; readonly values: Readonly<Record<string, string>> };
  readonly action?: { readonly column: string; readonly verbs: Readonly<Record<string, VerbMapping>> };
  readonly result?: { readonly column: string; readonly values: Readonly<Record<string, ReplayResult>> };
  readonly identify?: IdentifyMapping;
  /** Extra key -> column explicitly allowed into observation.extra. */
  readonly extra?: Readonly<Record<string, string>>;
}

function vectorColumns(vector: VectorMapping | undefined): string[] {
  if (vector === undefined) return [];
  return typeof vector === 'string' ? [vector] : [...vector];
}

/** Every telemetry column the mapping reads; all others are dropped. */
export function mappedColumns(mapping: PlaysMapping): Set<string> {
  const columns = [
    mapping.player.column,
    mapping.run.column,
    mapping.t.column,
    mapping.stage.column,
    ...(mapping.tick ? [mapping.tick.column] : []),
    ...(mapping.started_at ? [mapping.started_at.column] : []),
    ...(mapping.node ? [mapping.node.column] : []),
    ...vectorColumns(mapping.self?.pos),
    ...(mapping.self?.hp ? [mapping.self.hp.column, ...(mapping.self.hp.max_column ? [mapping.self.hp.max_column] : [])] : []),
    ...Object.values(mapping.self?.resources ?? {}).map((resource) => resource.column),
    ...(mapping.entities ? [mapping.entities.column] : []),
    ...(mapping.events ? [mapping.events.column] : []),
    ...(mapping.action ? [mapping.action.column] : []),
    ...Object.values(mapping.action?.verbs ?? {}).flatMap((verb) => [...(verb.operand ? [verb.operand] : []), ...vectorColumns(verb.operand_pos)]),
    ...(mapping.result ? [mapping.result.column] : []),
    ...Object.values(mapping.extra ?? {}),
  ];
  return new Set(columns);
}
