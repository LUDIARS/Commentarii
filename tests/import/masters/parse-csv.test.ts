import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ImportError } from '../../../src/import/import-error.ts';
import { parseCsvRecords, parseCsvTable } from '../../../src/import/masters/parse-csv.ts';
import { parseJsonTable } from '../../../src/import/masters/parse-json-table.ts';

test('CSV fields may be quoted, contain commas, quotes and newlines, and end with CRLF', () => {
  const records = parseCsvRecords('﻿a,b\r\n"x, y","say ""hi"""\r\n"multi\nline",2\r\n', 't.csv');
  assert.deepEqual(records, [
    ['a', 'b'],
    ['x, y', 'say "hi"'],
    ['multi\nline', '2'],
  ]);
});

test('a CSV table keys rows by header and numbers them from 1, skipping blank lines', () => {
  const table = parseCsvTable('slug,hp\nslime,10\n\nbat,\n', 'enemies.csv');
  assert.equal(table.name, 'enemies');
  assert.deepEqual(table.columns, ['slug', 'hp']);
  assert.deepEqual(table.rows, [
    { ref: 'enemies.csv#row=1', cells: { slug: 'slime', hp: '10' } },
    { ref: 'enemies.csv#row=2', cells: { slug: 'bat', hp: '' } },
  ]);
});

test('a CSV row with the wrong number of fields, a duplicate header or an open quote fails', () => {
  assert.throws(() => parseCsvTable('a,b\n1\n', 't.csv'), ImportError);
  assert.throws(() => parseCsvTable('a,a\n1,2\n', 't.csv'), ImportError);
  assert.throws(() => parseCsvRecords('a\n"open', 't.csv'), ImportError);
});

test('a JSON table is an array of objects; columns are the union of their keys', () => {
  const table = parseJsonTable('[{"slug":"slime","hp":10},{"slug":"bat","speed":3}]', 'enemies.json');
  assert.deepEqual(table.columns, ['slug', 'hp', 'speed']);
  assert.equal(table.rows[1]?.ref, 'enemies.json#row=2');
  assert.throws(() => parseJsonTable('{"slug":"x"}', 'enemies.json'), ImportError);
  assert.throws(() => parseJsonTable('[1]', 'enemies.json'), ImportError);
});
