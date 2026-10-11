// Composes the file system adapters with the loader: directory -> LoadResult.

import type { LoadResult } from '@ludiars/commentarii-sdk/types';
import { loadBundle } from '@ludiars/commentarii-sdk/bundle';
import { createSchemaRegistry } from '@ludiars/commentarii-sdk/schemas';
import { createFsBundleSource } from './fs-bundle-source.ts';
import { readSchemaDocuments } from './read-schema-documents.ts';

export async function openBundleDir(directory: string): Promise<LoadResult> {
  const registry = createSchemaRegistry(await readSchemaDocuments());
  return loadBundle(await createFsBundleSource(directory), registry);
}
