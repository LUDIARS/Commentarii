import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tactic } from '../../../src/domain/documents.ts';
import { generateCandidates } from '../../../src/engine/candidates/generate-candidates.ts';
import { EMPTY_RUN_MEMORY } from '../../../src/engine/candidates/run-memory.ts';
import { deriveVariant, deriveVariants, RELAX_FACTOR } from '../../../src/engine/candidates/tactic-variants.ts';
import { buildEngineWorld } from '../../../src/engine/world/build-engine-world.ts';
import { loadSample } from '../../support/bundles.ts';
import { enemy, frame, SPIDER, testPersona } from '../../support/personas.ts';

const KITE = 'tactic:bestia:kite-wire-spider';

async function kite(): Promise<Tactic> {
  const tactic = (await loadSample()).bundle.tactics.find(({ doc }) => doc.id === KITE)?.doc;
  assert.ok(tactic);
  return tactic;
}

test('each mutation gives a learned, unmeasured variant named <tactic>--<mutation>', async () => {
  const origin = await kite();
  const variants = deriveVariants(origin);
  assert.deepEqual(variants.map((variant) => variant.tactic.id), [`${KITE}--reorder`, `${KITE}--relax`, `${KITE}--substitute`]);
  for (const { tactic, of } of variants) {
    assert.equal(of, KITE);
    assert.equal(tactic.confidence, 'learned');
    assert.equal(tactic.superseded_by, null);
    assert.equal(tactic.metrics, undefined);
    assert.equal(tactic.knowledge, origin.knowledge);
    assert.deepEqual(tactic.expect, origin.expect);
  }
});

test('reorder rotates the steps, substitute replaces the first with the second', async () => {
  const origin = await kite();
  assert.deepEqual(deriveVariant(origin, 'reorder')?.tactic.do, [{ attack: '$enemy' }, { move_to: 'node:outer-ring' }]);
  assert.deepEqual(deriveVariant(origin, 'substitute')?.tactic.do, [{ attack: '$enemy' }, { attack: '$enemy' }]);
});

test('relax loosens every numeric threshold of when, but not inside not', async () => {
  const origin = await kite();
  const relaxed = deriveVariant(origin, 'relax')?.tactic.when;
  assert.deepEqual(relaxed, {
    all: [
      { entity: 'enemy:bestia:wire-spider', visible: true, distance_lt: 19 * RELAX_FACTOR },
      { self: { hp_ratio_lt: 0.5 * RELAX_FACTOR } },
    ],
  });
  const guarded: Tactic = { ...origin, when: { not: { self: { hp_ratio_lt: 0.5 } } } };
  assert.equal(deriveVariant(guarded, 'relax'), undefined, 'nothing to relax outside not');
});

test('a one-step tactic has no reorder or substitute variant', async () => {
  const origin = { ...(await kite()), do: [{ attack: '$enemy' }] };
  assert.equal(deriveVariant(origin, 'reorder'), undefined);
  assert.equal(deriveVariant(origin, 'substitute'), undefined);
});

test('variant candidates carry their origin; a relaxed one holds where the tactic does not', async () => {
  const world = buildEngineWorld((await loadSample()).bundle, 'player');
  // Spider at 21: beyond the tactic's 19, within the relaxed 23.75.
  const observation = frame({ hp: 0.4, entities: [enemy(SPIDER, 2, 21)] });
  const candidates = generateCandidates({ world, persona: testPersona(), observation, memory: EMPTY_RUN_MEMORY });
  const ids = candidates.map((candidate) => candidate.id);
  assert.ok(!ids.includes(KITE));
  const relaxed = candidates.find((candidate) => candidate.id === `variant:${KITE}--relax`);
  assert.ok(relaxed);
  assert.equal(relaxed.kind, 'explore');
  assert.equal(relaxed.traits.tactic, KITE);
  assert.deepEqual(relaxed.variant, { tactic: `${KITE}--relax`, of: KITE, mutation: 'relax' });
  assert.deepEqual(relaxed.bindings, { $enemy: 2 });
});
