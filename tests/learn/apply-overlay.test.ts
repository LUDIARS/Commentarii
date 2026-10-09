import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { buildEngineWorld } from '../../src/engine/world/build-engine-world.ts';
import { ingestRuns } from '../../src/learn/ingest/ingest-runs.ts';
import { applyOverlay } from '../../src/learn/overlay/apply-overlay.ts';
import { testPersona } from '../support/personas.ts';
import { CLOSE, driftedPolicy, loadDrifted, readRuns } from '../support/learn.ts';

test('the engine runs with the overlay: measured metrics win, rewrites join as learned, weights scale', async () => {
  const load = await loadDrifted();
  const { overlay } = ingestRuns({ bundle: load.bundle, gameId: 'bestia', policy: driftedPolicy(load), overlay: undefined, runs: await readRuns('drift-a') });
  const before = structuredClone(load.bundle);
  const persona = testPersona();
  const overlaid = applyOverlay(load.bundle, persona, { ...overlay, weights: { exploration: 1.2 } });
  assert.ok(isDeepStrictEqual(load.bundle, before), 'the canonical bundle is not touched');
  assert.equal(load.bundle.tactics.find(({ doc }) => doc.id === CLOSE)?.doc.metrics?.runs, 10);

  const world = buildEngineWorld(overlaid.bundle, 'player');
  assert.deepEqual(world.tactics.find((tactic) => tactic.id === CLOSE)?.metrics, overlay.tactics.find((entry) => entry.tactic === CLOSE)?.metrics);
  const learned = world.tactics.find((tactic) => tactic.id === `${CLOSE}--substitute`);
  assert.equal(learned?.confidence, 'learned');
  assert.equal(overlaid.persona.weights.exploration, persona.weights.exploration * 1.2);
  assert.equal(overlaid.persona.weights.distance, persona.weights.distance);
  assert.equal(persona.weights.exploration, 1, 'the input persona is not touched');
});
