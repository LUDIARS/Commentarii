// PersonaSource over the file system: <bundle>/personas/<slug>.json and the shipped
// <package root>/personas/<slug>.json.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PersonaDocument, PersonaSource } from '../../engine/persona/resolve-persona.ts';
import { findPackageRoot } from './package-root.ts';

const BYTE_ORDER_MARK = '﻿';

async function readPersonaFile(path: string): Promise<PersonaDocument | undefined> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw cause;
  }
  try {
    return { origin: path, data: JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text) as unknown };
  } catch (cause) {
    throw new Error(`persona ${path} is not valid JSON: ${(cause as Error).message}`);
  }
}

export function createFsPersonaSource(): PersonaSource {
  const shippedDir = join(findPackageRoot(import.meta.url), 'personas');
  return {
    readBundlePersona: (bundleDir, slug) => readPersonaFile(join(bundleDir, 'personas', `${slug}.json`)),
    readShippedPersona: (slug) => readPersonaFile(join(shippedDir, `${slug}.json`)),
    async listShippedPersonas() {
      const names = await readdir(shippedDir).catch(() => [] as string[]);
      return names.filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -'.json'.length)).sort();
    },
  };
}
