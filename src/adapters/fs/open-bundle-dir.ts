// Composes the file system adapters with the loader: directory -> LoadResult.

import type { LoadResult } from '../../bundle/bundle.ts';
import { loadBundle } from '../../bundle/load-bundle.ts';
import { createSchemaRegistry } from '../../schema/schema-registry.ts';
import { createFsBundleSource } from './fs-bundle-source.ts';
import { readSchemaDocuments } from './read-schema-documents.ts';

export async function openBundleDir(directory: string): Promise<LoadResult> {
  const registry = createSchemaRegistry(await readSchemaDocuments());
  return loadBundle(await createFsBundleSource(directory), registry);
}
