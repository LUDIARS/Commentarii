import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V22: a proposal list edited after it was hashed', async () => {
  await assertDetects('V22', 'v22-budget-proposals-hash');
});
