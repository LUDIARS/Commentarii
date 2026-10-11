import { test } from 'node:test';
import { assertDetects } from '../../support/detects.ts';

test('V15: outcomes whose p add up to 0.75 leave room for a hidden branch', async () => {
  await assertDetects('V15', 'v15-outcome-probabilities');
});
