// Locates the Commentarii package root (the directory holding schema/) from a module URL.
// Compiled code runs from dist/ or from the test build, at different depths, so walk up.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = join('schema', 'value.schema.json');

export function findPackageRoot(moduleUrl: string): string {
  let directory = dirname(fileURLToPath(moduleUrl));
  for (;;) {
    if (existsSync(join(directory, MARKER))) return directory;
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Commentarii schema directory not found above ${fileURLToPath(moduleUrl)}`);
    directory = parent;
  }
}
