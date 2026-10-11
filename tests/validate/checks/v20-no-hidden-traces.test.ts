import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V20: a visible action pointing at its .masked.json leaves a trace', async () => {
  await assertDetects('V20', 'v20-no-hidden-traces');
});
