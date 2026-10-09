// Master rows + table mapping -> the entities those rows describe. Pure: no merge with the
// existing bundle yet. Every value is a master value whose boundary defaults to masked.

import type { GuideValue, LocalizedText } from '../../domain/documents.ts';
import { ENTITY_GROUP_OF_KIND, type EntityKind } from '../../domain/id.ts';
import { ImportError } from '../import-error.ts';
import { DEFAULT_KNOWLEDGE, type TableMapping } from '../mapping.ts';
import type { MasterRow, MasterTable } from './master-table.ts';
import { readNumber, readText } from './read-cell.ts';
import { slugOf } from './slug-of.ts';

export interface ImportedRenderSignature {
  readonly mesh?: string;
  readonly sprite?: string;
  readonly material?: readonly string[];
}

export interface ImportedEntity {
  readonly id: string;
  /** entities/<group>/ directory. */
  readonly group: string;
  readonly slug: string;
  readonly ref: string;
  readonly name: LocalizedText;
  readonly behavior?: string;
  readonly renderSignature?: ImportedRenderSignature;
  /** Stat key -> value, in mapping order. */
  readonly stats: ReadonlyMap<string, GuideValue<number>>;
}

const DEFAULT_MATERIAL_SEPARATOR = '|';

function mappedColumns(mapping: TableMapping): string[] {
  const columns = [mapping.id.column, ...Object.values(mapping.name)];
  if (typeof mapping.kind !== 'string') columns.push(mapping.kind.column);
  if (mapping.behavior !== undefined) columns.push(mapping.behavior);
  const signature = mapping.render_signature;
  for (const column of [signature?.mesh, signature?.sprite, signature?.material]) if (column !== undefined) columns.push(column);
  for (const stat of Object.values(mapping.stats ?? {})) columns.push(stat.column);
  return columns;
}

function kindOf(row: MasterRow, mapping: TableMapping): EntityKind {
  if (typeof mapping.kind === 'string') return mapping.kind;
  const cell = readText(row, mapping.kind.column);
  const kind = cell === undefined ? undefined : mapping.kind.values[cell];
  if (kind === undefined) throw new ImportError(`${row.ref}: kind '${cell ?? ''}' in column '${mapping.kind.column}' is not in the mapping`);
  return kind;
}

function nameOf(row: MasterRow, mapping: TableMapping): LocalizedText {
  const name: Record<string, string> = {};
  for (const [lang, column] of Object.entries(mapping.name)) {
    const text = readText(row, column);
    if (text !== undefined) name[lang] = text;
  }
  if (Object.keys(name).length === 0) throw new ImportError(`${row.ref}: every name column is empty`);
  return name;
}

function renderSignatureOf(row: MasterRow, mapping: TableMapping): ImportedRenderSignature | undefined {
  const signature = mapping.render_signature;
  if (signature === undefined) return undefined;
  const mesh = signature.mesh === undefined ? undefined : readText(row, signature.mesh);
  const sprite = signature.sprite === undefined ? undefined : readText(row, signature.sprite);
  const materialCell = signature.material === undefined ? undefined : readText(row, signature.material);
  const material = materialCell
    ?.split(signature.material_separator ?? DEFAULT_MATERIAL_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const result = {
    ...(mesh !== undefined ? { mesh } : {}),
    ...(sprite !== undefined ? { sprite } : {}),
    ...(material !== undefined && material.length > 0 ? { material } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

function statsOf(row: MasterRow, mapping: TableMapping): Map<string, GuideValue<number>> {
  const stats = new Map<string, GuideValue<number>>();
  for (const [key, stat] of Object.entries(mapping.stats ?? {})) {
    const value = readNumber(row, stat.column);
    if (value === undefined) continue;
    stats.set(key, {
      value,
      ...(stat.unit !== undefined ? { unit: stat.unit } : {}),
      knowledge: stat.knowledge ?? DEFAULT_KNOWLEDGE,
      source: { kind: 'master', ref: row.ref },
    });
  }
  return stats;
}

function buildEntity(row: MasterRow, mapping: TableMapping, gameId: string): ImportedEntity {
  const kind = kindOf(row, mapping);
  const idCell = readText(row, mapping.id.column);
  if (idCell === undefined) throw new ImportError(`${row.ref}: ID column '${mapping.id.column}' is empty`);
  const slug = slugOf(idCell, mapping.id.slugify === true, row.ref);
  const behavior = mapping.behavior === undefined ? undefined : readText(row, mapping.behavior);
  const renderSignature = renderSignatureOf(row, mapping);
  return {
    id: `${kind}:${gameId}:${slug}`,
    group: ENTITY_GROUP_OF_KIND[kind],
    slug,
    ref: row.ref,
    name: nameOf(row, mapping),
    ...(behavior !== undefined ? { behavior } : {}),
    ...(renderSignature !== undefined ? { renderSignature } : {}),
    stats: statsOf(row, mapping),
  };
}

export function buildImportedEntities(table: MasterTable, mapping: TableMapping, gameId: string): ImportedEntity[] {
  const missing = mappedColumns(mapping).filter((column) => !table.columns.includes(column));
  if (missing.length > 0) throw new ImportError(`table '${table.name}' has no column ${[...new Set(missing)].map((c) => `'${c}'`).join(', ')}`);
  return table.rows.map((row) => buildEntity(row, mapping, gameId));
}
