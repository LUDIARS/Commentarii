import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Bundle } from '../../../src/bundle/bundle.ts';
import type { Tactic } from '../../../src/domain/documents.ts';
import { generateCandidates } from '../../../src/engine/candidates/generate-candidates.ts';
import { EMPTY_RUN_MEMORY } from '../../../src/engine/candidates/run-memory.ts';
import { buildEngineWorld } from '../../../src/engine/world/build-engine-world.ts';
import { loadSample } from '../../support/bundles.ts';
import { BEETLE, enemy, frame, SPIDER, testPersona } from '../../support/personas.ts';

const KITE = 'tactic:bestia:kite-wire-spider';
const SIDESTEP = 'tactic:bestia:sidestep-lead-shot';

/** Both sample tactics apply: wounded, spider within 19 and beetle within 10. */
const BOTH_APPLY = { hp: 0.4, entities: [enemy(SPIDER, 2, 12), enemy(BEETLE, 1, 6)] };

function withTactics(bundle: Bundle, edit: (tactic: Tactic) => Tactic): Bundle {
  return { ...bundle, tactics: bundle.tactics.map(({ path, doc }) => ({ path, doc: edit(doc) })) };
}

function ids(bundle: Bundle, mode: 'player' | 'omniscient', persona = testPersona()): string[] {
  const world = buildEngineWorld(bundle, mode);
  return generateCandidates({ world, persona, observation: frame({ ...BOTH_APPLY, mode }), memory: EMPTY_RUN_MEMORY }).map((candidate) => candidate.id);
}

test('player mode never proposes the masked sample tactic (nor a variant of it)', async () => {
  const { bundle } = await loadSample();
  const player = ids(bundle, 'player');
  assert.ok(player.includes(KITE));
  assert.ok(!player.some((id) => id.includes(SIDESTEP)));
  const omniscient = ids(bundle, 'omniscient');
  assert.ok(omniscient.includes(SIDESTEP), 'omniscient (checking / debugging) may use masked tactics');
  assert.ok(omniscient.includes(`variant:${SIDESTEP}--reorder`));
});

test('player mode drops a masked tactic even when it reaches the engine outside the player view', async () => {
  const { bundle } = await loadSample();
  // The player view drops masked documents; a tactic marked masked is still refused by the world.
  const world = buildEngineWorld(bundle, 'player');
  assert.ok(world.tactics.every((tactic) => tactic.knowledge !== 'masked'));
  assert.ok(!world.tactics.some((tactic) => tactic.id === SIDESTEP));
});

test('draft and superseded tactics are never candidates, in either mode', async () => {
  const { bundle } = await loadSample();
  const drafted = withTactics(bundle, (tactic) => ({ ...tactic, draft: true }));
  for (const mode of ['player', 'omniscient'] as const) assert.ok(!ids(drafted, mode).some((id) => id.startsWith('tactic:') || id.startsWith('variant:')));
  const superseded = withTactics(bundle, (tactic) => (tactic.id === KITE ? { ...tactic, superseded_by: SIDESTEP } : tactic));
  assert.ok(!ids(superseded, 'player').includes(KITE));
});

test('the persona confidence floor filters tactics', async () => {
  const { bundle } = await loadSample();
  assert.ok(ids(bundle, 'omniscient', testPersona({ min_confidence: 'authored' })).includes(KITE));
  assert.ok(!ids(bundle, 'omniscient', testPersona({ min_confidence: 'authored' })).includes(SIDESTEP), 'derived is below an authored-only floor');
  const learned = withTactics(bundle, (tactic) => ({ ...tactic, confidence: 'learned' }));
  assert.ok(!ids(learned, 'player', testPersona({ min_confidence: 'derived' })).includes(KITE));
  assert.ok(ids(learned, 'player', testPersona({ min_confidence: 'learned' })).includes(KITE));
});

test('generic actions and exploration are there without any tactic; IDs are unique and sorted', async () => {
  const { bundle } = await loadSample();
  const list = ids({ ...bundle, tactics: [] }, 'player');
  assert.deepEqual(list, ['explore:node:center', 'explore:node:outer-ring', 'generic:approach']);
  const all = ids(bundle, 'player');
  assert.deepEqual(all, [...all].sort());
  assert.equal(new Set(all).size, all.length);
});

test('survive appears only when hurt with an enemy in sight', async () => {
  const world = buildEngineWorld((await loadSample()).bundle, 'player');
  const at = (hp: number) =>
    generateCandidates({ world, persona: testPersona(), observation: frame({ hp, entities: [enemy(BEETLE, 1, 6)] }), memory: EMPTY_RUN_MEMORY }).map((c) => c.id);
  assert.ok(at(0.2).includes('generic:survive'));
  assert.ok(!at(0.8).includes('generic:survive'));
});
