// BundleSource over a directory on disk (guide/<game-id>/).

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { BundleSource } from '../../bundle/bundle-source.ts';

export async function createFsBundleSource(root: string): Promise<BundleSource> {
  const info = await stat(root).catch(() => undefined);
  if (info === undefined || !info.isDirectory()) throw new Error(`bundle directory not found: ${root}`);
  return {
    async listFiles() {
      const entries = await readdir(root, { recursive: true, withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
        .sort();
    },
    async readText(relativePath) {
      return readFile(join(root, ...relativePath.split('/')), 'utf8');
    },
  };
}
