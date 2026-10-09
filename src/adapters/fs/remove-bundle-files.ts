// Removes files (relative paths) under a bundle directory, refusing any path that would escape
// it. Used when a re-import empties a .masked.json companion.

import { rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export async function removeBundleFiles(bundleDir: string, paths: readonly string[]): Promise<void> {
  const root = resolve(bundleDir);
  for (const path of paths) {
    const target = resolve(root, ...path.split('/'));
    const inside = relative(root, target);
    if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) throw new Error(`refusing to remove outside ${root}: ${path}`);
    await rm(target, { force: true });
  }
}
