import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatChanges } from '../../../src/import/plan/format-changes.ts';

test('the dry-run diff shows new, changed and removed files field by field', () => {
  const text = formatChanges([
    { path: 'entities/enemies/a.json', before: undefined, after: { id: 'enemy:g:a' } },
    { path: 'entities/enemies/b.json', before: { stats: { hp: { value: 1 } }, old: true }, after: { stats: { hp: { value: 2 } }, added: 'x' } },
    { path: 'entities/enemies/b.masked.json', before: { id: 'enemy:g:b' }, after: undefined },
  ]);
  assert.equal(
    text,
    [
      '+ entities/enemies/a.json (new)',
      '    + /id: "enemy:g:a"',
      '~ entities/enemies/b.json',
      '    ~ /stats/hp/value: 1 -> 2',
      '    - /old: true',
      '    + /added: "x"',
      '- entities/enemies/b.masked.json (removed)',
      '',
    ].join('\n'),
  );
  assert.equal(formatChanges([]), 'no changes\n');
});
