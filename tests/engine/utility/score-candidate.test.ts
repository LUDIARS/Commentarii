import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTree } from '../../../src/engine/bt/build-tree.ts';
import type { Candidate } from '../../../src/engine/candidates/candidate.ts';
import { CONSIDERATION_NAMES } from '../../../src/engine/persona/persona.ts';
import { CONSIDERATIONS } from '../../../src/engine/utility/considerations.ts';
import { scoreCandidate } from '../../../src/engine/utility/score-candidate.ts';
import type { UtilityContext } from '../../../src/engine/utility/utility-context.ts';
import { buildEngineWorld } from '../../../src/engine/world/build-engine-world.ts';
import { loadSample } from '../../support/bundles.ts';
import { frame, testPersona } from '../../support/personas.ts';

function candidate(overrides: Partial<Candidate> & Pick<Candidate, 'id' | 'kind'>): Candidate {
  return { tree: buildTree({ action: { wait: 0 } }), bindings: {}, traits: { novelty: 0 }, ...overrides };
}

async function context(overrides: Partial<UtilityContext> = {}): Promise<UtilityContext> {
  const world = buildEngineWorld((await loadSample()).bundle, 'player');
  const observation = frame({ tick: 600, hp: 0.4 });
  return { observation, world, stage: world.stages.get('stage:bestia:dome-arena'), purpose: 'efficiency', exploring: false, ...overrides };
}

const KITE = candidate({
  id: 'tactic:bestia:kite-wire-spider',
  kind: 'tactic',
  traits: { targetDistance: 10, targetNode: 'node:outer-ring', progresses: true, confidence: 'authored', metrics: { runs: 12, success: 0.75, time_sec: { p50: 2.4 } }, tactic: 'tactic:bestia:kite-wire-spider', novelty: 1 },
});

test('every consideration stays within 0..1 (or says nothing)', async () => {
  const ctx = await context({ exploring: true });
  const survive = candidate({ id: 'generic:survive', kind: 'generic', traits: { targetDistance: 0, seeksSafety: true, novelty: 0 } });
  const node = candidate({ id: 'explore:node:outside', kind: 'explore', traits: { targetNode: 'node:outside', novelty: 1 } });
  for (const subject of [KITE, survive, node]) {
    for (const name of CONSIDERATION_NAMES) {
      const value = CONSIDERATIONS[name](subject, ctx);
      assert.ok(value === undefined || (value >= 0 && value <= 1), `${name} of ${subject.id} = ${value}`);
    }
  }
});

test('the intent teaches the kite tactic and forbids the outside except in coverage runs', async () => {
  const ctx = await context();
  assert.equal(CONSIDERATIONS.intent(KITE, ctx), 1);
  const outside = candidate({ id: 'explore:node:outside', kind: 'explore', traits: { targetNode: 'node:outside', novelty: 1 } });
  assert.equal(CONSIDERATIONS.intent(outside, ctx), 0);
  assert.equal(CONSIDERATIONS.intent(outside, await context({ purpose: 'coverage' })), undefined);
  const center = candidate({ id: 'explore:node:center', kind: 'explore', traits: { targetNode: 'node:center', novelty: 1 } });
  assert.equal(CONSIDERATIONS.intent(center, ctx), 1, 'center is on the intended route');
});

test('hp favours safety when hurt and pushing when healthy', async () => {
  const ctx = await context();
  const survive = candidate({ id: 'generic:survive', kind: 'generic', traits: { seeksSafety: true, novelty: 0 } });
  const approach = candidate({ id: 'generic:approach', kind: 'generic', traits: { progresses: true, novelty: 0 } });
  assert.ok(Math.abs((CONSIDERATIONS.hp(survive, ctx) ?? 0) - 0.6) < 1e-9);
  assert.ok(Math.abs((CONSIDERATIONS.hp(approach, ctx) ?? 0) - 0.4) < 1e-9);
});

test('exploration only counts on exploring ticks, where novelty wins', async () => {
  const node = candidate({ id: 'explore:node:center', kind: 'explore', traits: { targetNode: 'node:center', novelty: 1 } });
  assert.equal(CONSIDERATIONS.exploration(node, await context()), 0);
  assert.equal(CONSIDERATIONS.exploration(node, await context({ exploring: true })), 1);
  assert.equal(CONSIDERATIONS.exploration(KITE, await context()), undefined);
});

test('utility is the weighted mean of what applies, plus hysteresis when continuing', async () => {
  const ctx = await context();
  const persona = testPersona({ weights: { distance: 0, hp: 0, time: 0, resource: 0, confidence: 1, metrics: 0, intent: 0, exploration: 0 } });
  assert.equal(scoreCandidate(KITE, persona, ctx).utility, 1);
  const generic = candidate({ id: 'generic:approach', kind: 'generic' });
  assert.equal(scoreCandidate(generic, persona, ctx).utility, 0.4);
  assert.equal(scoreCandidate({ ...generic, continuing: true }, persona, ctx).utility, 0.5);
  const none = testPersona({ weights: { distance: 0, hp: 0, time: 0, resource: 0, confidence: 0, metrics: 0, intent: 0, exploration: 0 } });
  assert.equal(scoreCandidate(KITE, none, ctx).utility, 0);
});
