import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V14: a process rate calling an undeclared function is an unknown reference', async () => {
  await assertDetects('V14', 'v14-rulebook-references');
});
