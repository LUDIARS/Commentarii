import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V10: a tactic lighter than its strictest reference is reported', async () => {
  await assertDetects('V10', 'v10-tactic-knowledge');
});
