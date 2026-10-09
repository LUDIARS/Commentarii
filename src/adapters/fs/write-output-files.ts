// Writes generated files (relative path -> text) under an output directory, refusing any
// path that would escape it.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

export async function writeOutputFiles(outDir: string, files: ReadonlyMap<string, string>): Promise<void> {
  const root = resolve(outDir);
  for (const [path, text] of files) {
    const target = resolve(root, ...path.split('/'));
    const inside = relative(root, target);
    if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) throw new Error(`refusing to write outside ${root}: ${path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text, 'utf8');
  }
}
