// The sample guide declares what the Bestia stdio adapter (stage 6B, Bestia
// spec/feature/commentarii-adapter.md) puts in a player observation, so a player run against the
// real game is not stopped by the boundary; the omniscient-only fields stay refused in player mode.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observationBoundaryProblems } from '../../src/observation/check-observation-boundary.ts';
import type { ObservationFrame } from '../../src/replay/observation-frame.ts';
import { loadSample } from '../support/bundles.ts';

function bestiaPlayerFrame(extra: Record<string, unknown> = {}): ObservationFrame {
  return {
    tick: 3,
    t: 0.3,
    source: 'game-api',
    mode: 'player',
    purpose: 'efficiency',
    self: { pos: [0, 0, 20], hp: { value: 0.8, knowledge: 'shown' }, resources: { weapon_cooldown: 0.2, boost_cooldown: 1.5, auxiliary_cooldown: 0 } },
    entities: [{ entity: 'enemy:bestia:wire-spider', instance: 2, pos: [0, 0, 4], screen: [640, 360, 48, 40], state_guess: 'state:bestia:battle-ai#chase', confidence: 1 }],
    stage: { id: 'stage:bestia:dome-arena', elapsed: 0.3, node: 'node:mid-ring' },
    events: [{ kind: 'hit-taken' }, { kind: 'eliminated', instance: 3 }],
    extra: { reach: 19, ready_skills: ['volley'], weapon: 'skill:bestia:wire', auxiliary: 'gatling', ring_radius: 30, survivors: 4, ...extra },
  };
}

test('a Bestia player observation stays inside the sample guide boundary', async () => {
  const declarations = (await loadSample()).bundle.manifest?.doc.observation?.fields ?? [];
  assert.deepEqual(observationBoundaryProblems(bestiaPlayerFrame(), declarations), []);
});

test('the omniscient-only Bestia fields are refused in a player observation', async () => {
  const declarations = (await loadSample()).bundle.manifest?.doc.observation?.fields ?? [];
  for (const key of ['hp_actual', 'seed', 'behavior']) {
    const problems = observationBoundaryProblems(bestiaPlayerFrame({ [key]: 1 }), declarations);
    assert.deepEqual(problems.map((problem) => problem.code), ['unregistered'], key);
  }
});
