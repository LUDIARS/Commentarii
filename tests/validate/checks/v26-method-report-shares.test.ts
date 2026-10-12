import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V26: a method report whose rows do not add up to its episodes', async () => {
  await assertDetects('V26', 'v26-method-report-shares');
});
