// Structural difference of two JSON documents, for --dry-run. Objects are compared key by key;
// arrays and scalars are compared as a whole.

import { isDeepStrictEqual } from 'node:util';
import { isJsonObject } from '../../domain/value-node.ts';

export type DiffEntry =
  | { readonly op: 'add'; readonly pointer: string; readonly after: unknown }
  | { readonly op: 'remove'; readonly pointer: string; readonly before: unknown }
  | { readonly op: 'change'; readonly pointer: string; readonly before: unknown; readonly after: unknown };

function child(pointer: string, key: string): string {
  return `${pointer}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

export function diffDocuments(before: unknown, after: unknown, pointer = ''): DiffEntry[] {
  if (isDeepStrictEqual(before, after)) return [];
  if (!isJsonObject(before) || !isJsonObject(after)) return [{ op: 'change', pointer, before, after }];
  const entries: DiffEntry[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const at = child(pointer, key);
    if (!Object.hasOwn(after, key)) entries.push({ op: 'remove', pointer: at, before: before[key] });
    else if (!Object.hasOwn(before, key)) entries.push({ op: 'add', pointer: at, after: after[key] });
    else entries.push(...diffDocuments(before[key], after[key], at));
  }
  return entries;
}
