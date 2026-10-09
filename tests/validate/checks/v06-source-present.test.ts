import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V06: a value without source is reported', async () => {
  await assertDetects('V06', 'v06-source-present');
});
