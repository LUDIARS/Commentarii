// Typed reads of one telemetry row beyond the master cell readers: structured cells (a JSON
// value, or JSON text in a CSV cell), positions, timestamps and counts. Unreadable values fail
// with the row reference; empty cells read as undefined.

import type { Vector3 } from '../../replay/observation-frame.ts';
import { ImportError } from '../import-error.ts';
import type { MasterRow } from '../masters/master-table.ts';
import { readNumber, readText } from '../masters/read-cell.ts';
import type { VectorMapping } from './plays-mapping.ts';

/** A JSON array / object cell, or CSV text holding one. */
export function readStructured(row: MasterRow, column: string): unknown {
  const cell = row.cells[column];
  if (cell === undefined || cell === null) return undefined;
  if (typeof cell !== 'string') return cell;
  const text = cell.trim();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ImportError(`${row.ref}: column '${column}' is not JSON`);
  }
}

function toVector(row: MasterRow, what: string, values: readonly unknown[]): Vector3 {
  const numbers = values.map((value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value));
  const [x, y, z] = numbers;
  if (numbers.length !== 3 || typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || ![x, y, z].every(Number.isFinite)) {
    throw new ImportError(`${row.ref}: ${what} is not a position [x, y, z]`);
  }
  return [x, y, z];
}

export function readVector(row: MasterRow, mapping: VectorMapping): Vector3 | undefined {
  if (typeof mapping === 'string') {
    const value = readStructured(row, mapping);
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) throw new ImportError(`${row.ref}: column '${mapping}' is not a position [x, y, z]`);
    return toVector(row, `column '${mapping}'`, value);
  }
  const values = mapping.map((column) => readNumber(row, column));
  if (values.every((value) => value === undefined)) return undefined;
  return toVector(row, `columns ${mapping.join(', ')}`, values);
}

/** ISO 8601 text or epoch milliseconds -> Date. */
export function readTimestamp(row: MasterRow, column: string): Date | undefined {
  const text = readText(row, column);
  if (text === undefined) return undefined;
  const date = /^\d+(\.\d+)?$/.test(text) ? new Date(Number(text)) : new Date(text);
  if (Number.isNaN(date.getTime())) throw new ImportError(`${row.ref}: column '${column}' is not a timestamp`);
  return date;
}

/** A non-negative integer (tick, instance). */
export function readCount(row: MasterRow, column: string): number | undefined {
  const value = readNumber(row, column);
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 0) throw new ImportError(`${row.ref}: column '${column}' is not a non-negative integer`);
  return value;
}
