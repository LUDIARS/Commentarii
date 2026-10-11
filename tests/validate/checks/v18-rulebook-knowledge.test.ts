import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V18: a shown process that reads discoverable variables breaks propagation', async () => {
  await assertDetects('V18', 'v18-rulebook-knowledge');
});
