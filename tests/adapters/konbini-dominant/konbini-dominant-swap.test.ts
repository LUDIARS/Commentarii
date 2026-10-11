// Stage 8 (spec/feature/adapter-konbini-dominant.md): the second game runs on the same engine by
// swapping the guide and the adapter only. The golden session is what the KonbiniDominant stdio
// adapter must send; this checks the engine answers it with KonbiniDominant actions and that the
// frames stay inside the guide's observation boundary.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { openBundleDir } from '../../../src/adapters/fs/open-bundle-dir.ts';
import { createUtilityBtDecider } from '../../../src/engine/utility-bt-decider.ts';
import { observationBoundaryProblems } from '../../../src/observation/check-observation-boundary.ts';
import type { ObservationFrame } from '../../../src/replay/observation-frame.ts';
import { runValidation } from '../../../src/validate/run-validation.ts';
import { REPO_ROOT } from '../../support/bundles.ts';
import { testPersona } from '../../support/personas.ts';

const KD_DIR = join(REPO_ROOT, 'samples', 'konbini-dominant');
const SESSION = join(REPO_ROOT, 'tests', 'fixtures', 'konbini-dominant', 'session.jsonl');

async function sessionFrames(): Promise<ObservationFrame[]> {
  const lines = (await readFile(SESSION, 'utf8')).split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line) as { type: string; frame?: ObservationFrame });
  assert.equal(lines[0]?.type, 'hello');
  assert.equal(lines.at(-1)?.type, 'bye');
  return lines.flatMap((line) => (line.type === 'observation' && line.frame !== undefined ? [line.frame] : []));
}

test('the KonbiniDominant guide is valid on its own', async () => {
  assert.equal(runValidation(await openBundleDir(KD_DIR)).ok, true);
});

test('the same engine plays KonbiniDominant from its guide: choose a chain, build on free lots while cash allows, then save up', async () => {
  const load = await openBundleDir(KD_DIR);
  const decider = createUtilityBtDecider({ bundle: load.bundle, persona: testPersona() }, 8);
  const [select, build, again, broke] = (await sessionFrames()).map((frame) => decider.decide(frame).action);
  assert.deepEqual(select, { custom: 'select_chain', params: { chain: 'seban_ileban' } });
  assert.deepEqual(build, { interact: 101, params: { slot: 0 } });
  assert.deepEqual(again, { interact: 102, params: { slot: 0 } }, 'lot 101 is taken; 3200 still pays for another store');
  assert.equal(broke?.interact, undefined, 'no build without the cash for it');
  assert.equal(broke?.custom, undefined);
});

test('golden frames stay inside the declared boundary; an undeclared population leak is refused', async () => {
  const load = await openBundleDir(KD_DIR);
  const declarations = load.bundle.manifest?.doc.observation?.fields ?? [];
  for (const frame of await sessionFrames()) assert.deepEqual(observationBoundaryProblems(frame, declarations), []);
  const [, phase1] = await sessionFrames();
  assert.ok(phase1);
  const leaked = { ...phase1, extra: { ...phase1.extra, population_cells: [{ owner: 'losan', population: 120 }] } };
  assert.deepEqual(observationBoundaryProblems(leaked, declarations).map((problem) => problem.code), ['unregistered']);
});
