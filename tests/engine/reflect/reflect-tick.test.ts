import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tactic } from '../../../src/domain/documents.ts';
import { EMPTY_RUN_MEMORY } from '../../../src/engine/candidates/run-memory.ts';
import { tacticCandidate } from '../../../src/engine/candidates/tactic-candidates.ts';
import { variantCandidateId } from '../../../src/engine/candidates/variant-candidates.ts';
import { deriveVariant } from '../../../src/engine/candidates/tactic-variants.ts';
import { newPlan, type RunningPlan } from '../../../src/engine/engine-state.ts';
import type { OverlayLine } from '../../../src/engine/reflect/overlay-line.ts';
import { INITIAL_REFLECT_STATE, reflectEnd, reflectTick, type ReflectState } from '../../../src/engine/reflect/reflect-tick.ts';
import { buildReflectWorld, type ReflectWorld } from '../../../src/engine/reflect/reflect-world.ts';
import type { ObservationFrame } from '../../../src/replay/observation-frame.ts';
import { loadSample } from '../../support/bundles.ts';
import { enemy, frame, SPIDER } from '../../support/personas.ts';

const KITE = 'tactic:bestia:kite-wire-spider';

async function setup(): Promise<{ world: ReflectWorld; kite: Tactic }> {
  const { bundle } = await loadSample();
  const kite = bundle.tactics.find(({ doc }) => doc.id === KITE)?.doc;
  assert.ok(kite);
  return { world: buildReflectWorld(bundle, 'player'), kite };
}

function kitePlan(kite: Tactic, observation: ObservationFrame): RunningPlan {
  return newPlan(tacticCandidate(kite, { $enemy: 2 }, observation, EMPTY_RUN_MEMORY), observation.t);
}

/** Reflects the frames in order; acted[i] is the plan that acted on frames[i]. */
function reflectAll(world: ReflectWorld, frames: readonly ObservationFrame[], acted: readonly (RunningPlan | undefined)[]): { state: ReflectState; lines: OverlayLine[] } {
  let state = INITIAL_REFLECT_STATE;
  const lines: OverlayLine[] = [];
  frames.forEach((observation, index) => {
    const plan = acted[index];
    const result = reflectTick(state, { world, observation, ...(plan ? { acted: plan } : {}) });
    state = result.state;
    lines.push(...result.lines);
  });
  return { state, lines };
}

function outcomes(lines: readonly OverlayLine[]): unknown[] {
  return lines.filter((line) => line.kind === 'tactic-outcome').map((line) => line.observed?.outcome);
}

test('a tactic run opens with start and closes with success when its expect is met', async () => {
  const { world, kite } = await setup();
  const start = frame({ tick: 0, hp: 0.4, entities: [enemy(SPIDER, 2, 12, 'attack')] });
  const plan = kitePlan(kite, start);
  const frames = [start, frame({ tick: 5, hp: 0.3, node: 'node:outer-ring', entities: [enemy(SPIDER, 2, 12, 'attack')] }), frame({ tick: 12, hp: 0.3, node: 'node:outer-ring', entities: [enemy(SPIDER, 2, 15, 'chase')] })];
  const { lines, state } = reflectAll(world, frames, [plan, plan, plan]);
  assert.deepEqual(outcomes(lines), ['start', 'success']);
  const success = lines.find((line) => line.observed?.outcome === 'success');
  assert.deepEqual(success?.observed, { outcome: 'success', ticks: 12, time_sec: 1.2, damage_taken: 10, resource: {}, nodes: ['node:mid-ring', 'node:outer-ring'] });
  assert.equal(state.episodes.size, 0);
  // The plan keeps acting after its verdict: it is not reopened.
  assert.deepEqual(outcomes(reflectTick(state, { world, observation: frame({ tick: 13, entities: [] }), acted: plan }).lines), []);
});

test('a broken expect gives a mismatch and a failure', async () => {
  const { world, kite } = await setup();
  const start = frame({ tick: 0, hp: 0.4, entities: [enemy(SPIDER, 2, 12, 'attack')] });
  const plan = kitePlan(kite, start);
  const late = frame({ tick: 31, hp: 0.4, entities: [enemy(SPIDER, 2, 12, 'attack')] });
  const { lines } = reflectAll(world, [start, late], [plan, undefined]);
  const mismatch = lines.find((line) => line.kind === 'mismatch');
  assert.deepEqual(mismatch?.expected, kite.expect);
  assert.deepEqual(mismatch?.observed, { entity_state: { $enemy: 'state:bestia:battle-ai#attack' }, elapsed_sec: 3.1 });
  assert.deepEqual(outcomes(lines), ['start', 'failure']);
});

test('what is still open when the run ends is closed as unresolved', async () => {
  const { world, kite } = await setup();
  const start = frame({ tick: 0, hp: 0.4, entities: [enemy(SPIDER, 2, 12, 'attack')] });
  const { state } = reflectAll(world, [start], [kitePlan(kite, start)]);
  assert.deepEqual(reflectEnd(state).map((line) => [line.tactic, line.observed?.outcome]), [[KITE, 'unresolved']]);
  assert.deepEqual(reflectEnd(INITIAL_REFLECT_STATE), []);
});

test('a variant is measured under its own tactic ID and names its origin', async () => {
  const { world, kite } = await setup();
  const variant = deriveVariant(kite, 'substitute');
  assert.ok(variant);
  const start = frame({ tick: 0, hp: 0.4, entities: [enemy(SPIDER, 2, 12, 'attack')] });
  const base = tacticCandidate(variant.tactic, { $enemy: 2 }, start, EMPTY_RUN_MEMORY);
  const plan = newPlan({ ...base, id: variantCandidateId(variant), kind: 'explore', variant: { tactic: variant.tactic.id, of: KITE, mutation: 'substitute' } }, 0);
  const [line] = reflectAll(world, [start], [plan]).lines;
  assert.equal(line?.tactic, `${KITE}--substitute`);
  assert.deepEqual(line?.variant, { of: KITE, mutation: 'substitute' });
});

test('unknown entities are reported once per run: by ID, or by render signature', async () => {
  const { world } = await setup();
  const ghost = { entity: 'enemy:bestia:ghost-moth', instance: 7, pos: [5, 0, 0] as const };
  const shade = { instance: 8, pos: [6, 0, 0] as const };
  const signatures = { signatures: { '8': { mesh: 'mesh:bestia:shade', material: ['mat:bestia:dark', 'not an id'] } } };
  const frames = [
    frame({ tick: 0, entities: [ghost, shade, enemy(SPIDER, 2, 12)], extra: signatures }),
    frame({ tick: 1, entities: [ghost, shade], extra: signatures }),
  ];
  const lines = reflectAll(world, frames, []).lines.filter((line) => line.kind === 'unknown-entity');
  assert.deepEqual(
    lines.map((line) => [line.entity, line.observed]),
    [
      ['enemy:bestia:ghost-moth', { instance: 7 }],
      [undefined, { instance: 8, signature: { mesh: 'mesh:bestia:shade', material: ['mat:bestia:dark'] } }],
    ],
  );
});

test('damage dealt until a kill estimates the HP of that entity', async () => {
  const { world } = await setup();
  const spider = enemy(SPIDER, 2, 12);
  const frames = [
    frame({ tick: 0, entities: [spider], events: [{ kind: 'damage-dealt', instance: 2, amount: 60 }] }),
    frame({ tick: 1, entities: [spider], events: [{ kind: 'damage-dealt', instance: 2, amount: 50 }, { kind: 'damage-dealt', instance: 9, amount: 5 }] }),
    frame({ tick: 2, entities: [], events: [{ kind: 'damage-dealt', instance: 2, amount: 30 }, { kind: 'kill', instance: 2 }, { kind: 'kill', instance: 9 }] }),
  ];
  const estimates = reflectAll(world, frames, []).lines.filter((line) => line.kind === 'value-estimate');
  assert.deepEqual(
    estimates.map((line) => [line.entity, line.observed]),
    [[SPIDER, { quantity: 'hp', value: 140, basis: 'damage-dealt', hits: 3, instance: 2 }]],
    'instance 9 was never seen identified, so it estimates nothing',
  );
});
