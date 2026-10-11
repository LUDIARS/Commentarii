import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V19: an act entry passing a parameter the action lacks is a broken reference', async () => {
  await assertDetects('V19', 'v19-behavior-references');
});
