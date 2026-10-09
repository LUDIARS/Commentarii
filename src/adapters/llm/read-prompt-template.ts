// Reads a prompt template (prompts/<name>.md) shipped with Commentarii.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findPackageRoot } from '../fs/package-root.ts';

const PROMPT_NAME = /^[a-z0-9][a-z0-9-]*$/;

export async function readPromptTemplate(name: string): Promise<string> {
  if (!PROMPT_NAME.test(name)) throw new Error(`invalid prompt name: ${name}`);
  return readFile(join(findPackageRoot(import.meta.url), 'prompts', `${name}.md`), 'utf8');
}
