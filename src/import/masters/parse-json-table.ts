// JSON master table (an array of flat objects) -> MasterTable. Row n of source.ref counts from 1.

import { isJsonObject } from '../../domain/value-node.ts';
import { ImportError } from '../import-error.ts';
import { parseJsonInput } from '../parse-json-input.ts';
import { tableNameOf, type MasterRow, type MasterTable } from './master-table.ts';

export function parseJsonTable(text: string, fileName: string): MasterTable {
  const data = parseJsonInput(text, fileName);
  if (!Array.isArray(data)) throw new ImportError(`${fileName} must be a JSON array of row objects`);
  const columns = new Set<string>();
  const rows: MasterRow[] = data.map((item: unknown, position) => {
    const ref = `${fileName}#row=${position + 1}`;
    if (!isJsonObject(item)) throw new ImportError(`${ref} is not an object`);
    for (const column of Object.keys(item)) columns.add(column);
    return { ref, cells: item };
  });
  return { name: tableNameOf(fileName), columns: [...columns], rows };
}
