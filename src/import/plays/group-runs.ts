// Telemetry rows -> one row list per (player, run), each in play order: by the tick column when
// mapped, else by time, keeping the file order for equal keys. The raw identifiers are kept
// here only to hash them; they never leave the import.

import { ImportError } from '../import-error.ts';
import type { MasterRow } from '../masters/master-table.ts';
import { readNumber, readText } from '../masters/read-cell.ts';
import type { PlaysMapping } from './plays-mapping.ts';
import { readCount } from './read-row-values.ts';

export interface RowGroup {
  readonly player: string;
  readonly run: string;
  readonly rows: readonly MasterRow[];
}

function required(row: MasterRow, column: string, what: string): string {
  const value = readText(row, column);
  if (value === undefined) throw new ImportError(`${row.ref}: no ${what} in column '${column}'`);
  return value;
}

function orderKey(row: MasterRow, mapping: PlaysMapping): number {
  const key = mapping.tick === undefined ? readNumber(row, mapping.t.column) : readCount(row, mapping.tick.column);
  if (key === undefined) throw new ImportError(`${row.ref}: no ${mapping.tick === undefined ? 'time' : 'tick'}`);
  return key;
}

export function groupRuns(rows: readonly MasterRow[], mapping: PlaysMapping): RowGroup[] {
  const groups = new Map<string, { player: string; run: string; rows: MasterRow[] }>();
  for (const row of rows) {
    const player = required(row, mapping.player.column, 'player identifier');
    const run = required(row, mapping.run.column, 'run identifier');
    const key = JSON.stringify([player, run]);
    const group = groups.get(key) ?? { player, run, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const keyed = group.rows.map((row, index) => ({ row, index, key: orderKey(row, mapping) }));
    keyed.sort((a, b) => a.key - b.key || a.index - b.index);
    return { player: group.player, run: group.run, rows: keyed.map(({ row }) => row) };
  });
}
