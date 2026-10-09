// JSON Patch (RFC 6902) as guide learn consolidate writes it: the operations it needs (add,
// remove, replace, test) over JSON pointers (RFC 6901). Applying is pure: the input document is
// never mutated, and a failing operation (missing path, failed test) throws, so a patch either
// applies whole or not at all.

import { isDeepStrictEqual } from 'node:util';
import { isJsonObject } from '../../domain/value-node.ts';
import { contract } from '#contract-runtime'; /* augur-inject:import:b1c00ded */
import augurContract_6cda3dfd from '../../contracts/apply-json-patch.contract.ts'; /* augur-inject:contract-predicate:ea2bef6f */

export type JsonPatchOperation =
  | { readonly op: 'add'; readonly path: string; readonly value: unknown }
  | { readonly op: 'replace'; readonly path: string; readonly value: unknown }
  | { readonly op: 'remove'; readonly path: string }
  | { readonly op: 'test'; readonly path: string; readonly value: unknown };

export class JsonPatchError extends Error {
  override readonly name = 'JsonPatchError';
}

export function pointerSegment(key: string): string {
  return key.replaceAll('~', '~0').replaceAll('/', '~1');
}

function segmentsOf(path: string): string[] {
  if (path === '') return [];
  if (!path.startsWith('/')) throw new JsonPatchError(`invalid JSON pointer '${path}'`);
  return path
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function childOf(container: unknown, key: string, path: string): unknown {
  if (Array.isArray(container)) return container[Number(key)];
  if (isJsonObject(container) && Object.hasOwn(container, key)) return container[key];
  throw new JsonPatchError(`path ${path} does not exist`);
}

/** The value at `path`, or throws when it does not exist. */
export function valueAt(document: unknown, path: string): unknown {
  return segmentsOf(path).reduce((current, key) => childOf(current, key, path), document);
}

function setChild(container: unknown, key: string, value: unknown, op: 'add' | 'replace', path: string): void {
  if (Array.isArray(container)) {
    const index = key === '-' ? container.length : Number(key);
    if (!Number.isInteger(index) || index < 0 || index > container.length) throw new JsonPatchError(`bad array index in ${path}`);
    if (op === 'add') container.splice(index, 0, value);
    else if (index < container.length) container[index] = value;
    else throw new JsonPatchError(`path ${path} does not exist`);
    return;
  }
  if (!isJsonObject(container)) throw new JsonPatchError(`parent of ${path} is not a container`);
  if (op === 'replace' && !Object.hasOwn(container, key)) throw new JsonPatchError(`path ${path} does not exist`);
  container[key] = value;
}

function removeChild(container: unknown, key: string, path: string): void {
  if (Array.isArray(container)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= container.length) throw new JsonPatchError(`path ${path} does not exist`);
    container.splice(index, 1);
    return;
  }
  if (!isJsonObject(container) || !Object.hasOwn(container, key)) throw new JsonPatchError(`path ${path} does not exist`);
  delete container[key];
}

function applyOne(document: unknown, operation: JsonPatchOperation): unknown {
  if (operation.op === 'test') {
    if (!isDeepStrictEqual(valueAt(document, operation.path), operation.value)) throw new JsonPatchError(`test failed at ${operation.path || '/'}`);
    return document;
  }
  const segments = segmentsOf(operation.path);
  const last = segments.pop();
  if (last === undefined) {
    if (operation.op === 'remove') return undefined;
    return clone(operation.value);
  }
  const parent = segments.reduce((current, key) => childOf(current, key, operation.path), document);
  if (operation.op === 'remove') removeChild(parent, last, operation.path);
  else setChild(parent, last, clone(operation.value), operation.op, operation.path);
  return document;
}

/** The document after every operation, in order; `document` itself is left as it was. */
export function applyJsonPatch(document: unknown, operations: readonly JsonPatchOperation[]): unknown {
  return operations.reduce((current, operation) => applyOne(current, operation), clone(document));
}
// @ts-expect-error augur-inject
applyJsonPatch = contract(applyJsonPatch, { ...augurContract_6cda3dfd, contractId: 'C-35', mode: 'observe', sample: 1, where: 'src/learn/patch/json-patch.ts:90', rule: 'contract-wrap', id: '6cda3dfd' }); /* augur-inject:contract-wrap:6cda3dfd */
