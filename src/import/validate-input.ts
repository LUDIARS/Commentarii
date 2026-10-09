// Validates an import input against one of the bundled schemas and fails with every violation.

import type { DocumentSchemaName } from '../schema/schema-names.ts';
import type { SchemaRegistry } from '../schema/schema-registry.ts';
import { ImportError } from './import-error.ts';

export function assertSchema(registry: SchemaRegistry, schema: DocumentSchemaName, data: unknown, what: string): void {
  const violations = registry.validate(schema, data);
  if (violations.length === 0) return;
  const detail = violations.map((violation) => `  ${violation.pointer || '/'}: ${violation.message}`).join('\n');
  throw new ImportError(`${what} does not match ${schema}.schema.json:\n${detail}`);
}
