// Draft documents -> file changes. A draft replaces only a missing file or an earlier draft;
// a document a human already took over (draft is not true) is never overwritten.

import { isDeepStrictEqual } from 'node:util';
import { isJsonObject } from '../../domain/value-node.ts';
import type { FileChange } from '../plan/file-change.ts';
import type { DraftDocument } from './draft-request.ts';

export interface DraftWrites {
  readonly changes: readonly FileChange[];
  /** Paths left alone because they hold a non-draft document. */
  readonly protectedPaths: readonly string[];
}

export function planDraftWrites(documents: readonly DraftDocument[], existing: ReadonlyMap<string, unknown>): DraftWrites {
  const changes: FileChange[] = [];
  const protectedPaths: string[] = [];
  for (const { path, doc } of documents) {
    const current = existing.get(path);
    if (current !== undefined && !(isJsonObject(current) && current.draft === true)) protectedPaths.push(path);
    else if (!isDeepStrictEqual(current, doc)) changes.push({ path, before: current, after: doc });
  }
  return { changes, protectedPaths };
}
