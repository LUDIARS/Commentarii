// LearnIo over the file system: a missing file reads as undefined (ENOENT only; other errors
// such as permissions propagate), schemas come from the package's schema/ directory.

import { readFile } from 'node:fs/promises';
import { readSchemaDocuments } from '../../adapters/fs/read-schema-documents.ts';
import { createSchemaRegistry, type SchemaRegistry } from '../../schema/schema-registry.ts';
import type { LearnIo } from '../cli/learn-io.ts';

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

export function createFsLearnIo(): LearnIo {
  let registry: Promise<SchemaRegistry> | undefined;
  return {
    async readText(path) {
      try {
        return await readFile(path, 'utf8');
      } catch (error) {
        if (isMissing(error)) return undefined;
        throw error;
      }
    },
    schemaRegistry() {
      registry ??= readSchemaDocuments().then(createSchemaRegistry);
      return registry;
    },
  };
}
