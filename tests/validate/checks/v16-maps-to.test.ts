import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V16: maps_to with a verb the adapters do not have is outside the vocabulary', async () => {
  await assertDetects('V16', 'v16-maps-to');
});
