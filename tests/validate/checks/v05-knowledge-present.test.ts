import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V05: a value without knowledge is reported', async () => {
  await assertDetects('V05', 'v05-knowledge-present');
});
