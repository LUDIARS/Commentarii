// Telemetry row -> observation.extra: only the columns the mapping explicitly allows (design
// 14.D: free-text columns can hold proper names and are dropped unless allowed).

import type { MasterRow } from '../masters/master-table.ts';
import { readStructured } from './read-row-values.ts';

export function readExtra(row: MasterRow, allowed: Readonly<Record<string, string>> | undefined): Record<string, unknown> | undefined {
  if (allowed === undefined) return undefined;
  const extra: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(allowed)) {
    const cell = row.cells[column];
    const value = typeof cell === 'string' && /^\s*[[{]/.test(cell) ? readStructured(row, column) : cell;
    if (value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')) extra[key] = value;
  }
  return Object.keys(extra).length === 0 ? undefined : extra;
}
