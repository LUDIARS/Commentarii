// ScanSource over the file system: walks each --scan root without entering excluded
// directories. Reported paths keep the root as given, with POSIX separators.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScanSource } from './scan-source.ts';
import { EXCLUDED_DIRS } from './scan-targets.ts';

function toPosix(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

async function walk(directory: string, shown: string, out: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const shownPath = shown === '' ? entry.name : `${shown}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) await walk(join(directory, entry.name), shownPath, out);
    } else if (entry.isFile()) {
      out.push(shownPath);
    }
  }
}

export const fsScanSource: ScanSource = {
  async listFiles(roots) {
    const files: string[] = [];
    for (const root of roots) {
      const info = await stat(root).catch(() => undefined);
      if (info === undefined) throw new Error(`scan path not found: ${root}`);
      const shown = toPosix(root);
      if (info.isFile()) files.push(shown);
      else await walk(root, shown === '.' ? '' : shown, files);
    }
    return [...new Set(files)];
  },
  async readText(path) {
    return readFile(path, 'utf8');
  },
};
