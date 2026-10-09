import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V02: a tactic citing a field of a missing enemy is a broken reference', async () => {
  await assertDetects('V02', 'v02-references');
});
