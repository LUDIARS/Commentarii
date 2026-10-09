import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyJsonPatch, JsonPatchError, valueAt } from '../../src/learn/patch/json-patch.ts';

test('add / replace / remove / test apply in order without touching the input', () => {
  const document = { id: 'x', superseded_by: null, stats: { 'a/b': { value: 1 } }, list: [1, 2] };
  const result = applyJsonPatch(document, [
    { op: 'test', path: '/superseded_by', value: null },
    { op: 'replace', path: '/superseded_by', value: 'y' },
    { op: 'remove', path: '/stats/a~1b' },
    { op: 'add', path: '/stats/c', value: { value: 2 } },
    { op: 'add', path: '/list/-', value: 3 },
  ]);
  assert.deepEqual(result, { id: 'x', superseded_by: 'y', stats: { c: { value: 2 } }, list: [1, 2, 3] });
  assert.deepEqual(document, { id: 'x', superseded_by: null, stats: { 'a/b': { value: 1 } }, list: [1, 2] });
  assert.deepEqual(applyJsonPatch(null, [{ op: 'add', path: '', value: { id: 'new' } }]), { id: 'new' });
  assert.equal(valueAt(result, '/stats/c/value'), 2);
});

test('a failing operation throws JsonPatchError and the patch applies not at all', () => {
  const document = { superseded_by: 'z' };
  assert.throws(() => applyJsonPatch(document, [{ op: 'test', path: '/superseded_by', value: null }]), JsonPatchError);
  assert.throws(() => applyJsonPatch(document, [{ op: 'replace', path: '/missing', value: 1 }]), JsonPatchError);
  assert.throws(() => applyJsonPatch(document, [{ op: 'remove', path: '/a/b' }]), JsonPatchError);
  assert.throws(() => applyJsonPatch(document, [{ op: 'add', path: 'no-slash', value: 1 }]), JsonPatchError);
  assert.deepEqual(document, { superseded_by: 'z' });
});
