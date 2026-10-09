import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V03: a masked value in a public entity file is reported', async () => {
  await assertDetects('V03', 'v03-masked-outside');
});
