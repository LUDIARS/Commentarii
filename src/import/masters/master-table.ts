// Master data as rows, whatever the input format (CSV, JSON array, SQLite table).

export interface MasterRow {
  /** Provenance written to source.ref: `<file>#row=<n>` (CSV / JSON) or `<file>#table=<t>&rowid=<n>` (SQLite). */
  readonly ref: string;
  /** Column -> raw cell. CSV cells are strings; JSON and SQLite keep their scalar types. */
  readonly cells: Readonly<Record<string, unknown>>;
}

export interface MasterTable {
  /** Key into mapping.tables: the file stem (CSV / JSON) or the SQLite table name. */
  readonly name: string;
  /** Every column the table has, so that a mapping naming a missing column fails up front. */
  readonly columns: readonly string[];
  readonly rows: readonly MasterRow[];
}

/** `archetypes.csv` -> `archetypes`. */
export function tableNameOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}
