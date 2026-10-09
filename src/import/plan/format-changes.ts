// FileChange[] -> the text `--dry-run` prints: one header per file, one line per changed field.

import { diffDocuments, type DiffEntry } from './diff-documents.ts';
import type { FileChange } from './file-change.ts';

function json(value: unknown): string {
  return JSON.stringify(value);
}

function formatEntry(entry: DiffEntry): string {
  switch (entry.op) {
    case 'add':
      return `    + ${entry.pointer}: ${json(entry.after)}`;
    case 'remove':
      return `    - ${entry.pointer}: ${json(entry.before)}`;
    case 'change':
      return `    ~ ${entry.pointer}: ${json(entry.before)} -> ${json(entry.after)}`;
  }
}

function formatChange(change: FileChange): string[] {
  if (change.after === undefined) return [`- ${change.path} (removed)`];
  if (change.before === undefined) return [`+ ${change.path} (new)`, ...diffDocuments({}, change.after).map(formatEntry)];
  return [`~ ${change.path}`, ...diffDocuments(change.before, change.after).map(formatEntry)];
}

export function formatChanges(changes: readonly FileChange[]): string {
  if (changes.length === 0) return 'no changes\n';
  return `${changes.flatMap(formatChange).join('\n')}\n`;
}
