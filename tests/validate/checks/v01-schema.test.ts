import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V01: an entity without its required name is a schema violation', async () => {
  await assertDetects('V01', 'v01-schema');
});
