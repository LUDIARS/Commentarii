// Reads the schema documents the replay line schema needs (REPLAY_SCHEMA_FILES) from schema/.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REPLAY_SCHEMA_FILES } from '../../replay/replay-schema.ts';
import { findPackageRoot } from './package-root.ts';

export async function readReplaySchemaDocuments(): Promise<Map<string, unknown>> {
  const directory = join(findPackageRoot(import.meta.url), 'schema');
  const documents = new Map<string, unknown>();
  for (const fileName of REPLAY_SCHEMA_FILES) {
    documents.set(fileName, JSON.parse(await readFile(join(directory, fileName), 'utf8')) as unknown);
  }
  return documents;
}
