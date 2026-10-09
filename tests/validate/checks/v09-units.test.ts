import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V09: the same stat in two units is reported', async () => {
  await assertDetects('V09', 'v09-units');
});
