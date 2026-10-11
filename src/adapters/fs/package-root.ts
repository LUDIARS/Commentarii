// Locates the Commentarii package root (the nearest directory holding package.json) from a
// module URL. Compiled code runs from dist/ or from the test build, at different depths, so walk
// up; neither output directory has a package.json of its own. The schemas live in the SDK
// (schemaDirectory of @ludiars/commentarii-sdk/schemas), not here.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'package.json';

export function findPackageRoot(moduleUrl: string): string {
  let directory = dirname(fileURLToPath(moduleUrl));
  for (;;) {
    if (existsSync(join(directory, MARKER))) return directory;
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Commentarii package root not found above ${fileURLToPath(moduleUrl)}`);
    directory = parent;
  }
}
