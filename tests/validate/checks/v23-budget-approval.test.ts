import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V23: an approval naming another proposal list', async () => {
  await assertDetects('V23', 'v23-budget-approval');
});
