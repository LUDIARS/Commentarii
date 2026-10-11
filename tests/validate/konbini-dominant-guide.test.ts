// The second game's guide (stage 8, spec/feature/adapter-konbini-dominant.md) stays valid on its own.
// Its engine-side test (the golden session answered by the same engine) moved to Ingenium with the
// runtime and reads this guide's --knowledge full export.

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { runValidation } from '../../src/validate/run-validation.ts';
import { REPO_ROOT } from '../support/bundles.ts';

test('the KonbiniDominant guide is valid on its own', async () => {
  assert.equal(runValidation(await openBundleDir(join(REPO_ROOT, 'samples', 'konbini-dominant'))).ok, true);
});
