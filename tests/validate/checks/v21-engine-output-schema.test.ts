import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V21: an opponent model with an unknown motion class does not follow its schema', async () => {
  await assertDetects('V21', 'v21-engine-output-schema');
});
