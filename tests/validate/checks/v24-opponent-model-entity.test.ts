import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V24: an opponent model stored under another slug than its entity', async () => {
  await assertDetects('V24', 'v24-opponent-model-entity');
});
