// FileChange[] -> what the file system adapter has to do: texts to write and paths to remove.

import type { FileChange } from './file-change.ts';

export interface FileOperations {
  readonly writes: ReadonlyMap<string, string>;
  readonly removals: readonly string[];
}

/** Bundle documents are written as 2-space JSON with a trailing newline. */
export function serializeDocument(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function toFileOperations(changes: readonly FileChange[]): FileOperations {
  const writes = new Map<string, string>();
  const removals: string[] = [];
  for (const change of changes) {
    if (change.after !== undefined) writes.set(change.path, serializeDocument(change.after));
    else if (change.before !== undefined) removals.push(change.path);
  }
  return { writes, removals };
}
