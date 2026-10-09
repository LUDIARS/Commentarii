// Content hash of a consolidate proposal (spec/feature/learning.md §4.2): SHA-256 over the
// canonical JSON (keys sorted, no whitespace) of everything an approver judges - the file
// patches, the evidence runs, the measured comparison and the basis (game, guide version,
// condition, units). Any change to any of these gives another hash, which voids an approval.

import { createHash } from 'node:crypto';
import { isJsonObject } from '../../domain/value-node.ts';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isJsonObject(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function contentHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}
