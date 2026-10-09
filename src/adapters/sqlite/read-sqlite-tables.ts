// SQLite master data -> MasterTable per mapped table, through Node's built-in node:sqlite (no
// added dependency). The database is opened read-only and closed on every path.

import { basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ImportError } from '../../import/import-error.ts';
import type { MasterRow, MasterTable } from '../../import/masters/master-table.ts';

const ROWID_COLUMN = '__commentarii_rowid__';

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function readTable(database: DatabaseSync, table: string, fileName: string): MasterTable {
  const columns = database
    .prepare(`SELECT name FROM pragma_table_info(?)`)
    .all(table)
    .map((row) => String(row.name));
  const rows: MasterRow[] = database
    .prepare(`SELECT rowid AS ${quoteIdentifier(ROWID_COLUMN)}, * FROM ${quoteIdentifier(table)} ORDER BY rowid`)
    .all()
    .map((record) => {
      const { [ROWID_COLUMN]: rowid, ...cells } = record;
      return { ref: `${fileName}#table=${table}&rowid=${String(rowid)}`, cells };
    });
  return { name: table, columns, rows };
}

export function readSqliteTables(path: string, tables: readonly string[]): MasterTable[] {
  const fileName = basename(path);
  let database: DatabaseSync;
  try {
    database = new DatabaseSync(path, { readOnly: true });
  } catch (cause) {
    throw new ImportError(`${fileName} cannot be opened as SQLite: ${(cause as Error).message}`);
  }
  try {
    const existing = new Set(
      database
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
        .all()
        .map((row) => String(row.name)),
    );
    return tables.map((table) => {
      if (!existing.has(table)) throw new ImportError(`${fileName} has no table '${table}'`);
      return readTable(database, table, fileName);
    });
  } finally {
    database.close();
  }
}
