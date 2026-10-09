import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAllow } from '../../src/audit/apply-allow.ts';
import type { Finding } from '../../src/audit/audit-report.ts';
import { globToRegExp } from '../../src/audit/path-glob.ts';

const FINDINGS: readonly Finding[] = [
  { kind: 'value-hit', file: 'ui/legacy.json', line: 1, column: 1, ref: 'enemy:g:a.stats.x', reason: 'r' },
  { kind: 'key-hit', file: 'net/state.proto', line: 2, column: 3, ref: 'forbidden_keys:rng_seed', reason: 'r' },
  { kind: 'undefined-exposure', file: 'ui/en.json', line: 4, column: 5, ref: 'literal:250', reason: 'r' },
];

test('globs: ** crosses directories, * stays in one segment, bare names match at any depth', () => {
  assert.ok(globToRegExp('**/ui/*.json').test('E:/repo/ui/en.json'));
  assert.ok(globToRegExp('ui/*.json').test('ui/en.json'));
  assert.equal(globToRegExp('ui/*.json').test('ui/sub/en.json'), false);
  assert.ok(globToRegExp('*.proto').test('net/deep/state.proto'));
  assert.ok(globToRegExp('save?.ts').test('src/save1.ts'));
});

test('allow rules filter by path, and optionally by kind and ref', () => {
  const { kept, allowed } = applyAllow(FINDINGS, [
    { pattern: 'ui/legacy.json', rationale: 'debug only', decided_by: 'neco' },
    { pattern: '**/*.proto', kind: 'key-hit', ref: 'forbidden_keys:drop_rate', rationale: 'other key', decided_by: 'neco' },
    { pattern: 'ui/*.json', kind: 'value-hit', rationale: 'wrong kind', decided_by: 'neco' },
  ]);
  assert.deepEqual(allowed.map((finding) => [finding.file, finding.allow.rationale, finding.allow.decided_by]), [['ui/legacy.json', 'debug only', 'neco']]);
  assert.deepEqual(kept.map((finding) => finding.file), ['net/state.proto', 'ui/en.json']);
});
