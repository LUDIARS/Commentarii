import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectUndefinedExposure } from '../../src/audit/detect-undefined-exposure.ts';

const KNOWN = new Set([180]);

function literals(path: string, text: string, minNumericLength = 3): string[] {
  return detectUndefinedExposure({ path, text }, KNOWN, minNumericLength).map((finding) => finding.ref);
}

test('unknown numbers in localization tables are reported, known ones are not', () => {
  assert.deepEqual(literals('ui/en.po', 'msgstr "Deals 250 damage, heals 180"'), ['literal:250']);
  assert.deepEqual(literals('ui/en.csv', 'key,text\nshop,Buy 1200 coins'), ['literal:1200']);
});

test('in JSON only string values count', () => {
  assert.deepEqual(literals('ui/en.json', '{ "limit": 999, "text": "Up to 999 items" }'), ['literal:999']);
});

test('short numbers stay below the threshold', () => {
  assert.deepEqual(literals('ui/en.yaml', 'level: "Lv 12"', 3), []);
  assert.deepEqual(literals('ui/en.yaml', 'level: "Lv 12"', 2), ['literal:12']);
});

test('code files are not UI tables', () => {
  assert.deepEqual(literals('src/save.ts', 'const SLOT_SIZE = 4096;'), []);
});

test('columns are relative to the whole line', () => {
  const [finding] = detectUndefinedExposure({ path: 'a.json', text: '{ "t": "x 250" }' }, KNOWN, 3);
  assert.equal(finding?.column, 11);
});
