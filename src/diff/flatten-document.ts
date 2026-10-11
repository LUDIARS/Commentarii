// A document as leaves for the semantic diff (design 14.I): every value node is one leaf carrying
// its payload and boundary label, every other scalar or array is one leaf of its own. Pointers
// are RFC 6901, the same as the boundary checks use, so a change can be traced to the file.

import { isJsonObject, isKnowledge, isValueNode, type Knowledge } from '@ludiars/commentarii-sdk/types';

export interface Leaf {
  readonly value: unknown;
  /** Set when the leaf is a value node with a knowledge label. */
  readonly knowledge?: Knowledge;
}

function escapeSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function flattenDocument(document: unknown): ReadonlyMap<string, Leaf> {
  const leaves = new Map<string, Leaf>();
  const visit = (current: unknown, pointer: string): void => {
    if (isValueNode(current)) {
      leaves.set(pointer, isKnowledge(current.knowledge) ? { value: current.value, knowledge: current.knowledge } : { value: current.value });
      return;
    }
    if (isJsonObject(current)) {
      for (const [key, child] of Object.entries(current)) visit(child, `${pointer}/${escapeSegment(key)}`);
      return;
    }
    // Arrays stay whole: their order is meaningful (routes, do-lists) and an index-wise diff
    // would report a shift as many unrelated edits.
    leaves.set(pointer, { value: current });
  };
  visit(document, '');
  return leaves;
}
