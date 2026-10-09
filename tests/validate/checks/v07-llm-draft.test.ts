import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V07: an llm-draft value with draft: false is reported', async () => {
  await assertDetects('V07', 'v07-llm-draft');
});
