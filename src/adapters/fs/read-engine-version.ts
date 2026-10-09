// The engine's version from the package's own package.json (recorded in bench results).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findPackageRoot } from './package-root.ts';

export async function readEngineVersion(): Promise<string> {
  const text = await readFile(join(findPackageRoot(import.meta.url), 'package.json'), 'utf8');
  const version = (JSON.parse(text) as { version?: unknown }).version;
  if (typeof version !== 'string' || version === '') throw new Error('package.json has no version');
  return version;
}
