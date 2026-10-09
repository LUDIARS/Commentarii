// Play log mapping text -> PlaysMapping, validated against schema/plays-mapping.schema.json,
// plus the rules the schema cannot say (a custom verb names its action).

import type { SchemaRegistry } from '../../schema/schema-registry.ts';
import { ImportError } from '../import-error.ts';
import { parseJsonInput } from '../parse-json-input.ts';
import { assertSchema } from '../validate-input.ts';
import type { PlaysMapping } from './plays-mapping.ts';

export function parsePlaysMapping(text: string, fileName: string, registry: SchemaRegistry): PlaysMapping {
  const data = parseJsonInput(text, fileName);
  assertSchema(registry, 'plays-mapping', data, fileName);
  const mapping = data as PlaysMapping;
  for (const [input, verb] of Object.entries(mapping.action?.verbs ?? {})) {
    if (verb.verb === 'custom' && verb.custom === undefined) throw new ImportError(`${fileName}: action input '${input}' is custom but names no custom action`);
  }
  return mapping;
}
