// Which mapping applies to which master table: mapping.tables is keyed by the CSV / JSON file
// stem or by the SQLite table name. A table without a mapping is an error, not a skip.

import { ImportError } from '../import-error.ts';
import type { Mapping } from '../mapping.ts';
import type { MasterTable } from './master-table.ts';
import type { MappedTable } from './plan-master-import.ts';

export function mappedTableNames(mapping: Mapping, mappingName: string): string[] {
  const names = Object.keys(mapping.tables ?? {});
  if (names.length === 0) throw new ImportError(`${mappingName} declares no tables`);
  return names;
}

export function pairTables(tables: readonly MasterTable[], mapping: Mapping, mappingName: string): MappedTable[] {
  return tables.map((table) => {
    const tableMapping = mapping.tables?.[table.name];
    if (tableMapping === undefined) {
      const known = Object.keys(mapping.tables ?? {}).join(', ') || 'none';
      throw new ImportError(`${mappingName} has no tables.${table.name} (declared: ${known})`);
    }
    return { table, mapping: tableMapping };
  });
}
