// Reads the SDK's bundled JSON Schemas (packages/sdk/schema/*.schema.json) for the schema registry.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_SCHEMAS, schemaDirectory, schemaFileName } from '@ludiars/commentarii-sdk/schemas';

export async function readSchemaDocuments(): Promise<Map<string, unknown>> {
  const directory = schemaDirectory();
  const documents = new Map<string, unknown>();
  for (const name of ALL_SCHEMAS) {
    const fileName = schemaFileName(name);
    documents.set(fileName, JSON.parse(await readFile(join(directory, fileName), 'utf8')) as unknown);
  }
  return documents;
}
