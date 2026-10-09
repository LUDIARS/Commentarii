// Last check before human plays are written (design 10, 14.D): no key or string anywhere in the
// output may equal a raw player or run identifier. The conversion only copies mapped, resolved
// fields, so this holds by construction; the check catches a mapping that lets an identifier
// through anyway (for example an allowed extra column holding it). The message never repeats
// the identifier itself.

import { ImportError } from '../import-error.ts';

function findRawIdentifier(value: unknown, raw: ReadonlySet<string>, pointer: string): string | undefined {
  if (typeof value === 'string') return raw.has(value) ? pointer : undefined;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findRawIdentifier(item, raw, `${pointer}/${index}`);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (raw.has(key)) return `${pointer}/(key)`;
    const found = findRawIdentifier(child, raw, `${pointer}/${key}`);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** files: bundle-relative path -> JSON or JSON Lines text. */
export function assertNoRawIdentifiers(files: ReadonlyMap<string, string>, raw: ReadonlySet<string>): void {
  for (const [path, text] of files) {
    const documents = path.endsWith('.jsonl') ? text.split('\n').filter((line) => line !== '') : [text];
    for (const [index, document] of documents.entries()) {
      const found = findRawIdentifier(JSON.parse(document) as unknown, raw, '');
      if (found !== undefined) {
        throw new ImportError(`${path}${path.endsWith('.jsonl') ? ` line ${index + 1}` : ''} ${found || '/'} holds a raw player or run identifier; remove that column from the mapping`);
      }
    }
  }
}
