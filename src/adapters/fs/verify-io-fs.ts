// VerifyIo over the file system: run / feasibility files from paths (directories walked
// recursively), missing files read as undefined (ENOENT only), schemas from the package.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ListedFiles, VerifyIo } from '../../verify/cli/verify-io.ts';
import { createSchemaRegistry, type SchemaRegistry } from '../../schema/schema-registry.ts';
import { readSchemaDocuments } from './read-schema-documents.ts';
import { replaySchema } from './replay-open-file.ts';

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

async function listOne(path: string, extension: string): Promise<string[] | undefined> {
  let info;
  try {
    info = await stat(path);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  if (!info.isDirectory()) return [path];
  const entries = await readdir(path, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => join(entry.parentPath, entry.name));
}

export function createFsVerifyIo(): VerifyIo {
  let registry: Promise<SchemaRegistry> | undefined;
  return {
    async listFiles(paths, extension): Promise<ListedFiles> {
      const files = new Set<string>();
      const missing: string[] = [];
      for (const path of paths) {
        const found = await listOne(path, extension);
        if (found === undefined) missing.push(path);
        else for (const file of found) files.add(file);
      }
      return { files: [...files].sort(), missing };
    },
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
    replaySchema,
  };
}
