// Telemetry row -> observation.events. Only game event names the mapping lists become events
// (under the guide's kind); any other name is dropped and counted, since a free event name
// could carry anything.

import type { ObservedEvent } from '../../replay/observation-frame.ts';
import type { MasterRow } from '../masters/master-table.ts';
import { countIn, type ImportTally } from './import-tally.ts';
import type { PlaysMapping } from './plays-mapping.ts';
import { readStructured } from './read-row-values.ts';

function namesOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

function cellNames(row: MasterRow, column: string): string[] {
  const cell = row.cells[column];
  // A plain CSV cell is one name; JSON text or a JSON array may hold several.
  if (typeof cell === 'string' && !cell.trim().startsWith('[')) return cell.trim() === '' ? [] : [cell.trim()];
  return namesOf(readStructured(row, column));
}

export function readEvents(row: MasterRow, mapping: PlaysMapping['events'], tally: ImportTally): ObservedEvent[] {
  if (mapping === undefined) return [];
  return cellNames(row, mapping.column).flatMap((name) => {
    const kind = mapping.values[name];
    if (kind === undefined) {
      countIn(tally, 'unmapped events');
      return [];
    }
    return [{ kind }];
  });
}
