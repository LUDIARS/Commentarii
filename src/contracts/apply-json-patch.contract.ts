// C-35 applyJsonPatch(document, operations): the input document is left exactly as it was,
// and a failure is a JsonPatchError (the patch applies whole or not at all).

import { JsonPatchError, type JsonPatchOperation } from '../learn/patch/json-patch.ts';

const before = new WeakMap<readonly JsonPatchOperation[], string>();

function snapshot(document: unknown): string {
  return JSON.stringify(document) ?? 'undefined';
}

export default {
  pre: (document: unknown, operations: readonly JsonPatchOperation[]) => {
    before.set(operations, snapshot(document));
    return true;
  },
  post: (_result: unknown, document: unknown, operations: readonly JsonPatchOperation[]) =>
    before.get(operations) === snapshot(document) || 'the input document was modified',
  postThrow: (error: unknown) => error instanceof JsonPatchError || `failed with ${(error as Error).name} instead of JsonPatchError`,
};
