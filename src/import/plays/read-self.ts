// Telemetry row -> observation.self: position, HP as the bar ratio, resources. Every read
// value carries the boundary the mapping declares, masked when it declares none (principle 1);
// a masked value then fails the import as a mapping error (principle 2).

import type { ObservedSelf, ObservedValue } from '../../replay/observation-frame.ts';
import { DEFAULT_KNOWLEDGE } from '../mapping.ts';
import type { MasterRow } from '../masters/master-table.ts';
import { readNumber } from '../masters/read-cell.ts';
import { ImportError } from '../import-error.ts';
import type { HpMapping, SelfMapping } from './plays-mapping.ts';
import { readVector } from './read-row-values.ts';

function readHp(row: MasterRow, hp: HpMapping): ObservedValue | undefined {
  const value = readNumber(row, hp.column);
  if (value === undefined) return undefined;
  const max = hp.max_column === undefined ? hp.max : readNumber(row, hp.max_column);
  if (max !== undefined && max <= 0) throw new ImportError(`${row.ref}: the HP maximum must be positive`);
  return { value: max === undefined ? value : value / max, knowledge: hp.knowledge ?? DEFAULT_KNOWLEDGE };
}

export function readSelf(row: MasterRow, mapping: SelfMapping | undefined): ObservedSelf {
  if (mapping === undefined) return {};
  const pos = mapping.pos === undefined ? undefined : readVector(row, mapping.pos);
  const hp = mapping.hp === undefined ? undefined : readHp(row, mapping.hp);
  const resources: Record<string, ObservedValue> = {};
  for (const [name, resource] of Object.entries(mapping.resources ?? {})) {
    const value = readNumber(row, resource.column);
    if (value !== undefined) resources[name] = { value, knowledge: resource.knowledge ?? DEFAULT_KNOWLEDGE };
  }
  return {
    ...(pos === undefined ? {} : { pos }),
    ...(hp === undefined ? {} : { hp }),
    ...(Object.keys(resources).length === 0 ? {} : { resources }),
  };
}
