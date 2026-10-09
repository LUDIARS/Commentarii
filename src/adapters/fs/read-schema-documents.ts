// Reads the bundled JSON Schemas (schema/*.schema.json) for the schema registry.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_SCHEMAS, schemaFileName } from '../../schema/schema-names.ts';
import { findPackageRoot } from './package-root.ts';

export async function readSchemaDocuments(): Promise<Map<string, unknown>> {
  const directory = join(findPackageRoot(import.meta.url), 'schema');
  const documents = new Map<string, unknown>();
  for (const name of ALL_SCHEMAS) {
    const fileName = schemaFileName(name);
    documents.set(fileName, JSON.parse(await readFile(join(directory, fileName), 'utf8')) as unknown);
  }
  return documents;
}
