// Where a replay record carries `knowledge: masked` (principle 2: a player run must hold none).
// Deliberately stricter than domain/value-node.ts findKnowledgeHolders, which skips value
// payloads by bundle semantics: a recording is rejected if masked appears at any depth.

import { isJsonObject } from '../domain/value-node.ts';

function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/** JSON pointers (RFC 6901, relative to `value`) of every object whose knowledge is masked. */
export function findMaskedPointers(value: unknown, base = ''): string[] {
  const found: string[] = [];
  const visit = (current: unknown, pointer: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${pointer}/${index}`));
      return;
    }
    if (!isJsonObject(current)) return;
    if (current.knowledge === 'masked') found.push(pointer);
    for (const [key, child] of Object.entries(current)) visit(child, `${pointer}/${escapePointerSegment(key)}`);
  };
  visit(value, base);
  return found;
}
