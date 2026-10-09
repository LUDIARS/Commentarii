import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V12: an intent teaching a missing tactic is reported', async () => {
  await assertDetects('V12', 'v12-intent-refs');
});
