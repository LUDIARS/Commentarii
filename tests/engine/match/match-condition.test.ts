import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchCondition } from '../../../src/engine/match/match-condition.ts';
import { BEETLE, enemy, frame, SPIDER } from '../../support/personas.ts';

const KITE_WHEN = { all: [{ entity: SPIDER, visible: true, distance_lt: 19 }, { self: { hp_ratio_lt: 0.5 } }] };

test('the sample kite condition binds the nearest matching spider as $enemy', () => {
  const observation = frame({ hp: 0.4, entities: [enemy(SPIDER, 5, 15), enemy(SPIDER, 2, 10), enemy(BEETLE, 1, 3)] });
  assert.deepEqual(matchCondition(KITE_WHEN, observation), { ok: true, bindings: { $enemy: 2 } });
  assert.equal(matchCondition(KITE_WHEN, frame({ hp: 0.6, entities: [enemy(SPIDER, 2, 10)] })).ok, false);
  assert.equal(matchCondition(KITE_WHEN, frame({ hp: 0.4, entities: [enemy(SPIDER, 2, 25)] })).ok, false);
});

test('entity leaves: visible false, distance_gt, state, confidence, as, and $binding re-checks', () => {
  const observation = frame({ entities: [enemy(SPIDER, 2, 10, 'chase')] });
  assert.equal(matchCondition({ entity: BEETLE, visible: false }, observation).ok, true);
  assert.equal(matchCondition({ entity: SPIDER, visible: false }, observation).ok, false);
  assert.equal(matchCondition({ entity: SPIDER, distance_gt: 12 }, observation).ok, false);
  assert.equal(matchCondition({ entity: SPIDER, state: 'state:bestia:battle-ai#chase' }, observation).ok, true);
  assert.equal(matchCondition({ entity: SPIDER, state: 'state:bestia:battle-ai#attack' }, observation).ok, false);
  assert.equal(matchCondition({ entity: SPIDER, min_confidence: 0.5 }, observation).ok, true);
  assert.deepEqual(matchCondition({ entity: SPIDER, as: '$prey' }, observation).bindings, { $prey: 2 });
  const chained = { all: [{ entity: SPIDER }, { entity: '$enemy', distance_lt: 11 }] };
  assert.equal(matchCondition(chained, observation).ok, true);
  assert.equal(matchCondition({ entity: '$enemy' }, observation).ok, false);
});

test('self leaves: hp, skills, items, resources, node', () => {
  const observation = {
    ...frame({ hp: 0.3, extra: { ready_skills: ['skill:bestia:stun'], items: { 'item:bestia:potion': 2 } } }),
    self: { pos: [0, 0, 0] as const, hp: { value: 0.3, knowledge: 'shown' as const }, resources: { stamina: 40 } },
  };
  assert.equal(matchCondition({ self: { hp_ratio_lt: 0.5, hp_ratio_gt: 0.2 } }, observation).ok, true);
  assert.equal(matchCondition({ self: { skill_ready: 'skill:bestia:stun' } }, observation).ok, true);
  assert.equal(matchCondition({ self: { skill_ready: 'skill:bestia:roar' } }, observation).ok, false);
  assert.equal(matchCondition({ self: { has_item: 'item:bestia:potion' } }, observation).ok, true);
  assert.equal(matchCondition({ self: { resource_gte: { stamina: 40 } } }, observation).ok, true);
  assert.equal(matchCondition({ self: { resource_lt: { stamina: 40 } } }, observation).ok, false);
  assert.equal(matchCondition({ self: { at_node: 'node:mid-ring' } }, observation).ok, true);
  const noHp = { ...observation, self: {} };
  assert.equal(matchCondition({ self: { hp_ratio_lt: 1 } }, noHp).ok, false, 'unknown hp never satisfies a comparison');
});

test('stage, event and composite conditions', () => {
  const observation = frame({ tick: 50, events: [{ kind: 'hit' }] });
  assert.equal(matchCondition({ stage: { id: 'stage:bestia:dome-arena', elapsed_gt: 4, elapsed_lt: 6 } }, observation).ok, true);
  assert.equal(matchCondition({ stage: { node: 'node:center' } }, observation).ok, false);
  assert.equal(matchCondition({ event: 'hit' }, observation).ok, true);
  assert.equal(matchCondition({ any: [{ event: 'kill' }, { event: 'hit' }] }, observation).ok, true);
  assert.equal(matchCondition({ not: { event: 'hit' } }, observation).ok, false);
});

test('anything outside the vocabulary never holds', () => {
  const observation = frame({ entities: [enemy(SPIDER, 2, 10)] });
  assert.equal(matchCondition({ entity: SPIDER, near_wall: true }, observation).ok, false);
  assert.equal(matchCondition({ self: { mana_gte: 3 } }, observation).ok, false);
  assert.equal(matchCondition({ weather: 'rain' }, observation).ok, false);
  assert.equal(matchCondition({ all: [] }, observation).ok, false);
  assert.equal(matchCondition('entity', observation).ok, false);
});
