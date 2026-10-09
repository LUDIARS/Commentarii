// Telemetry row -> observation.entities. Each item's game identifier goes through identify; an
// unidentified entity keeps its instance (and position) only, so the raw identifier is never
// written (design 7.2: an entity the adapter cannot identify is recorded as unknown).

import { isJsonObject } from '../../domain/value-node.ts';
import type { ObservedEntity } from '../../replay/observation-frame.ts';
import { ImportError } from '../import-error.ts';
import type { MasterRow } from '../masters/master-table.ts';
import { readText } from '../masters/read-cell.ts';
import type { Identify } from './identify.ts';
import { countIn, type ImportTally } from './import-tally.ts';
import type { EntitiesMapping } from './plays-mapping.ts';
import { readCount, readStructured, readVector } from './read-row-values.ts';

function readEntity(item: MasterRow, mapping: EntitiesMapping, identify: Identify, tally: ImportTally): ObservedEntity {
  const instance = readCount(item, mapping.fields.instance);
  if (instance === undefined) throw new ImportError(`${item.ref}: an entity needs '${mapping.fields.instance}'`);
  const identifier = readText(item, mapping.fields.entity);
  const entity = identifier === undefined ? undefined : identify(identifier);
  if (entity === undefined) countIn(tally, 'unidentified entities');
  const pos = mapping.fields.pos === undefined ? undefined : readVector(item, mapping.fields.pos);
  return { ...(entity === undefined ? {} : { entity }), instance, ...(pos === undefined ? {} : { pos }) };
}

export function readEntities(row: MasterRow, mapping: EntitiesMapping | undefined, identify: Identify, tally: ImportTally): ObservedEntity[] {
  if (mapping === undefined) return [];
  const value = readStructured(row, mapping.column);
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ImportError(`${row.ref}: column '${mapping.column}' is not an array of entities`);
  return value.map((item: unknown, index) => {
    const ref = `${row.ref} ${mapping.column}[${index}]`;
    if (!isJsonObject(item)) throw new ImportError(`${ref} is not an object`);
    return readEntity({ ref, cells: item }, mapping, identify, tally);
  });
}
