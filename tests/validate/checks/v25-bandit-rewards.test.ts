import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V25: a summed reward above the episode count', async () => {
  await assertDetects('V25', 'v25-bandit-rewards');
});
