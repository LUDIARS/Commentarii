// JSON Lines telemetry (one flat object per line) -> MasterTable. Blank lines are skipped; row n
// of the reference counts records from 1, as for CSV and JSON tables.

import { isJsonObject } from '../../domain/value-node.ts';
import { ImportError } from '../import-error.ts';
import { tableNameOf, type MasterRow, type MasterTable } from '../masters/master-table.ts';

const BYTE_ORDER_MARK = '﻿';

export function parseJsonlTable(text: string, fileName: string): MasterTable {
  const source = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  const columns = new Set<string>();
  const rows: MasterRow[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const ref = `${fileName}#row=${rows.length + 1}`;
    let item: unknown;
    try {
      item = JSON.parse(line) as unknown;
    } catch (cause) {
      throw new ImportError(`${ref} is not valid JSON: ${(cause as Error).message}`);
    }
    if (!isJsonObject(item)) throw new ImportError(`${ref} is not an object`);
    for (const column of Object.keys(item)) columns.add(column);
    rows.push({ ref, cells: item });
  }
  return { name: tableNameOf(fileName), columns: [...columns], rows };
}
