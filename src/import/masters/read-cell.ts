// Typed reads of one master cell. An empty cell (missing, null, blank string) reads as
// undefined so that the value is left out; anything unreadable fails with the row reference.

import { ImportError } from '../import-error.ts';
import type { MasterRow } from './master-table.ts';

function raw(row: MasterRow, column: string): unknown {
  const cell = row.cells[column];
  if (cell === undefined || cell === null) return undefined;
  if (typeof cell === 'string' && cell.trim() === '') return undefined;
  return cell;
}

export function readText(row: MasterRow, column: string): string | undefined {
  const cell = raw(row, column);
  if (cell === undefined) return undefined;
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number' || typeof cell === 'bigint' || typeof cell === 'boolean') return String(cell);
  throw new ImportError(`${row.ref}: column '${column}' is not text`);
}

export function readNumber(row: MasterRow, column: string): number | undefined {
  const cell = raw(row, column);
  if (cell === undefined) return undefined;
  const number = typeof cell === 'string' ? Number(cell.trim()) : typeof cell === 'bigint' ? Number(cell) : cell;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new ImportError(`${row.ref}: column '${column}' is not a number (${JSON.stringify(String(cell))})`);
  }
  if (typeof cell === 'bigint' && !Number.isSafeInteger(number)) throw new ImportError(`${row.ref}: column '${column}' is too large`);
  return number;
}
