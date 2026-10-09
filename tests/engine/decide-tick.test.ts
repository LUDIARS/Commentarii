import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideTick, HOLD_BACK_SEC, type TickOutcome } from '../../src/engine/decide-tick.ts';
import { INITIAL_ENGINE_STATE, type EngineState } from '../../src/engine/engine-state.ts';
import type { Persona } from '../../src/engine/persona/persona.ts';
import { buildEngineWorld } from '../../src/engine/world/build-engine-world.ts';
import type { EngineWorld } from '../../src/engine/world/engine-world.ts';
import type { ObservationFrame } from '../../src/replay/observation-frame.ts';
import { loadSample } from '../support/bundles.ts';
import { enemy, frame, SPIDER, testPersona } from '../support/personas.ts';

const KITE = 'tactic:bestia:kite-wire-spider';
const CALM = { explore: 0.99, misplay: 0.99 };

/** Kite-only persona: the guide's confidence and intent decide, nothing else. */
const KITER = testPersona({ weights: { distance: 0, hp: 0, time: 0, resource: 0, confidence: 1, metrics: 0, intent: 1, exploration: 0 } });

async function playerWorld(): Promise<EngineWorld> {
  return buildEngineWorld((await loadSample()).bundle, 'player');
}

function tick(world: EngineWorld, persona: Persona, frames: readonly ObservationFrame[], rolls = CALM): TickOutcome[] {
  let state: EngineState = INITIAL_ENGINE_STATE;
  return frames.map((observation) => {
    const outcome = decideTick({ world, persona, state, observation, rolls });
    state = outcome.state;
    return outcome;
  });
}

test('the chosen candidate is logged with every other candidate and its utility', async () => {
  const [outcome] = tick(await playerWorld(), KITER, [frame({ hp: 0.4, entities: [enemy(SPIDER, 2, 12, 'attack')] })]);
  assert.equal(outcome?.chosen, KITE);
  assert.deepEqual(outcome?.action, { move_to: 'node:outer-ring' });
  assert.equal(outcome?.decision.filter((entry) => entry.chosen).length, 1);
  assert.ok(outcome?.decision.some((entry) => entry.candidate === 'generic:approach' && !entry.chosen));
});

test('a running tactic continues; once done its expectation is watched before it is proposed again', async () => {
  const world = await playerWorld();
  const spider = (state: string) => [enemy(SPIDER, 2, 12, state)];
  const outcomes = tick(world, KITER, [
    frame({ tick: 0, hp: 0.4, entities: spider('attack') }),
    frame({ tick: 1, hp: 0.4, node: 'node:outer-ring', entities: spider('attack') }),
    frame({ tick: 2, hp: 0.4, node: 'node:outer-ring', entities: spider('attack') }),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.chosen), [KITE, KITE, 'generic:approach']);
  assert.deepEqual(outcomes[1]?.action, { attack: 2 });
  assert.ok(outcomes[2]?.state.memory.watching.has(KITE));
  assert.ok(!outcomes[2]?.decision.some((entry) => entry.candidate === KITE));
});

test('a broken expectation holds the tactic back; a met one frees it at once', async () => {
  const world = await playerWorld();
  const spider = (state: string) => [enemy(SPIDER, 2, 12, state)];
  const base = [frame({ tick: 0, hp: 0.4, entities: spider('attack') }), frame({ tick: 1, hp: 0.4, node: 'node:outer-ring', entities: spider('attack') })];
  // within_sec is 3: at t = 3.1 the spider still attacks -> broken.
  const broken = tick(world, KITER, [...base, frame({ tick: 31, hp: 0.4, node: 'node:outer-ring', entities: spider('attack') })]);
  const last = broken[2];
  assert.equal(last?.state.memory.watching.has(KITE), false);
  assert.ok(Math.abs((last?.state.memory.heldBackUntil.get(KITE) ?? 0) - (3.1 + HOLD_BACK_SEC)) < 1e-9);
  const met = tick(world, KITER, [...base, frame({ tick: 5, hp: 0.4, node: 'node:outer-ring', entities: spider('chase') })]);
  assert.equal(met[2]?.chosen, KITE, 'a tactic whose expectation was met may run again right away');
  assert.equal(met[2]?.state.memory.heldBackUntil.has(KITE), false);
});

test('reaction delay decides on an older observation', async () => {
  const world = await playerWorld();
  const slow = testPersona({ ...KITER, reaction_delay_ticks: 2 });
  const frames = [frame({ tick: 0, hp: 1, entities: [enemy(SPIDER, 2, 12, 'attack')] }), frame({ tick: 1, hp: 0.4, entities: [enemy(SPIDER, 2, 12, 'attack')] })];
  const fast = tick(world, KITER, frames).map((outcome) => outcome.chosen);
  const delayed = tick(world, slow, frames).map((outcome) => outcome.chosen);
  assert.equal(fast[1], KITE, 'without delay the wound is seen at once');
  assert.notEqual(fast[0], KITE);
  assert.ok(!delayed.includes(KITE), 'two ticks of delay: the persona still sees full HP');
});

test('a misplay keeps the decision but fumbles the action into a wait', async () => {
  const world = await playerWorld();
  const clumsy = testPersona({ ...KITER, misplay_rate: 0.5 });
  const [outcome] = tick(world, clumsy, [frame({ hp: 0.4, entities: [enemy(SPIDER, 2, 12)] })], { explore: 0.99, misplay: 0.1 });
  assert.equal(outcome?.chosen, KITE);
  assert.equal(outcome?.misplayed, true);
  assert.deepEqual(outcome?.action, { wait: 0 });
});

test('with nothing to act on the engine waits', async () => {
  const world = buildEngineWorld({ ...(await loadSample()).bundle, stages: [], tactics: [] }, 'player');
  const [outcome] = tick(world, KITER, [frame()]);
  assert.equal(outcome?.chosen, undefined);
  assert.deepEqual(outcome?.action, { wait: 0 });
});
