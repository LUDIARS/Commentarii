// Mapping file text -> Mapping, validated against schema/mapping.schema.json.

import type { SchemaRegistry } from '../schema/schema-registry.ts';
import type { Mapping } from './mapping.ts';
import { parseJsonInput } from './parse-json-input.ts';
import { assertSchema } from './validate-input.ts';

export function parseMapping(text: string, fileName: string, registry: SchemaRegistry): Mapping {
  const data = parseJsonInput(text, fileName);
  assertSchema(registry, 'mapping', data, fileName);
  return data as Mapping;
}
