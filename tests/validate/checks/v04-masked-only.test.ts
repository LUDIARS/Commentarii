import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V04: a discoverable value inside a .masked.json is reported', async () => {
  await assertDetects('V04', 'v04-masked-only');
});
