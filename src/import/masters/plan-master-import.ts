// guide import masters, pure part: master tables + mapping + the current bundle files ->
// the entity files to write or remove. Unchanged files are left out.

import { isDeepStrictEqual } from 'node:util';
import { ImportError } from '../import-error.ts';
import type { TableMapping } from '../mapping.ts';
import type { FileChange } from '../plan/file-change.ts';
import { buildImportedEntities, type ImportedEntity } from './build-imported-entities.ts';
import type { MasterTable } from './master-table.ts';
import { mergeEntity } from './merge-entity.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:3e18faf2 */
import augurContract_4e8b3aec from '../../contracts/plan-master-import.contract.ts'; /* augur-inject:contract-predicate:d2894eef */

export interface MappedTable {
  readonly table: MasterTable;
  readonly mapping: TableMapping;
}

export interface MasterImportInput {
  readonly gameId: string;
  readonly tables: readonly MappedTable[];
  /** Bundle-relative path -> parsed JSON of every readable bundle file. */
  readonly existing: ReadonlyMap<string, unknown>;
}

function assertUniqueIds(entities: readonly ImportedEntity[]): void {
  const seen = new Map<string, string>();
  for (const entity of entities) {
    const first = seen.get(entity.id);
    if (first !== undefined) throw new ImportError(`${entity.ref}: ${entity.id} is already imported from ${first}`);
    seen.set(entity.id, entity.ref);
  }
}

function change(path: string, before: unknown, after: unknown): FileChange[] {
  return isDeepStrictEqual(before, after) ? [] : [{ path, before, after }];
}

export function planMasterImport(input: MasterImportInput): FileChange[] {
  const entities = input.tables.flatMap(({ table, mapping }) => buildImportedEntities(table, mapping, input.gameId));
  assertUniqueIds(entities);
  const changes: FileChange[] = [];
  for (const entity of entities) {
    const publicPath = `entities/${entity.group}/${entity.slug}.json`;
    const maskedPath = `entities/${entity.group}/${entity.slug}.masked.json`;
    const currentPublic = input.existing.get(publicPath);
    const currentMasked = input.existing.get(maskedPath);
    const merged = mergeEntity(entity, currentPublic, currentMasked);
    changes.push(...change(publicPath, currentPublic, merged.public));
    changes.push(...change(maskedPath, currentMasked, merged.masked));
  }
  return changes;
}
// @ts-expect-error augur-inject
planMasterImport = contract(planMasterImport, { ...augurContract_4e8b3aec, contractId: 'C-12', mode: 'observe', sample: 1, where: 'src/import/masters/plan-master-import.ts:37', rule: 'contract-wrap', id: '4e8b3aec' }); /* augur-inject:contract-wrap:4e8b3aec */
