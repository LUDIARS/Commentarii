// Test helpers: load the sample bundle, or the sample with a broken-fixture overlay on top.

import { join } from 'node:path';
import { createFsBundleSource } from '../../src/adapters/fs/fs-bundle-source.ts';
import { findPackageRoot } from '../../src/adapters/fs/package-root.ts';
import { readSchemaDocuments } from '../../src/adapters/fs/read-schema-documents.ts';
import type { LoadResult } from '@ludiars/commentarii-sdk/types';
import type { BundleSource } from '@ludiars/commentarii-sdk/bundle';
import { loadBundle } from '@ludiars/commentarii-sdk/bundle';
import { createSchemaRegistry, type SchemaRegistry } from '@ludiars/commentarii-sdk/schemas';

export const REPO_ROOT = findPackageRoot(import.meta.url);
export const SAMPLE_DIR = join(REPO_ROOT, 'samples', 'bestia');
export const BROKEN_DIR = join(REPO_ROOT, 'tests', 'fixtures', 'broken');

let registry: SchemaRegistry | undefined;

export async function schemaRegistry(): Promise<SchemaRegistry> {
  registry ??= createSchemaRegistry(await readSchemaDocuments());
  return registry;
}

/** Files of `overlay` win over the files of `base` at the same relative path. */
export function overlaySource(base: BundleSource, overlay: BundleSource): BundleSource {
  let overlayFiles: Set<string> | undefined;
  const overlayPaths = async (): Promise<Set<string>> => {
    overlayFiles ??= new Set(await overlay.listFiles());
    return overlayFiles;
  };
  return {
    async listFiles() {
      return [...new Set([...(await base.listFiles()), ...(await overlayPaths())])].sort();
    },
    async readText(path) {
      return (await overlayPaths()).has(path) ? overlay.readText(path) : base.readText(path);
    },
  };
}

export async function loadSample(): Promise<LoadResult> {
  return loadBundle(await createFsBundleSource(SAMPLE_DIR), await schemaRegistry());
}

export async function loadBroken(fixture: string): Promise<LoadResult> {
  const source = overlaySource(await createFsBundleSource(SAMPLE_DIR), await createFsBundleSource(join(BROKEN_DIR, fixture)));
  return loadBundle(source, await schemaRegistry());
}
