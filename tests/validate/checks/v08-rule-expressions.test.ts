import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V08: a rule expression with an undefined variable cannot be evaluated', async () => {
  await assertDetects('V08', 'v08-rule-expressions');
});
