import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V17: a masked override without its visible action is not separated', async () => {
  await assertDetects('V17', 'v17-masked-separation');
});
