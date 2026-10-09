import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V11: an enemy without a state machine is a coverage warning', async () => {
  await assertDetects('V11', 'v11-coverage', 'warning');
});
