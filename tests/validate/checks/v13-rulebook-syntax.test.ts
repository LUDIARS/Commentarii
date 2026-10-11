import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V13: a rulebook expression that stops mid-way does not parse', async () => {
  await assertDetects('V13', 'v13-rulebook-syntax');
});
