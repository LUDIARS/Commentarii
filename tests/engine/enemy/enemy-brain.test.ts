import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFsBundleSource } from '../../../src/adapters/fs/fs-bundle-source.ts';
import { createSimAdapter } from '../../../src/adapters/sim/sim-adapter.ts';
import type { SimEnemyBrain } from '../../../src/adapters/sim/sim-world.ts';
import type { Bundle } from '../../../src/bundle/bundle.ts';
import { loadBundle } from '../../../src/bundle/load-bundle.ts';
import { runDriver } from '../../../src/engine/driver.ts';
import { createEnemyBrain } from '../../../src/engine/enemy/enemy-brain.ts';
import { findMaskedPointers } from '../../../src/replay/find-masked-pointers.ts';
import { observationBoundaryProblems } from '../../../src/observation/check-observation-boundary.ts';
import type { ObservationFrame } from '../../../src/replay/observation-frame.ts';
import { createWaitDecider } from '../../../src/replay/wait-decider.ts';
import { overlaySource, REPO_ROOT, SAMPLE_DIR, schemaRegistry } from '../../support/bundles.ts';
import { testPersona } from '../../support/personas.ts';

const PLAYER = 'actor:bestia:player';
const ENEMY_GUIDE = join(REPO_ROOT, 'tests', 'fixtures', 'enemy-ai');

/** Fixed tree state (samples/bestia battle-ai, as the sim plays it) -> the tactic that reproduces it. */
const TACTIC_OF_STATE = {
  chase: 'tactic:bestia:enemy-chase',
  attack: 'tactic:bestia:enemy-attack',
  dodge: 'tactic:bestia:enemy-dodge',
  retreat: 'tactic:bestia:enemy-retreat',
  return: 'tactic:bestia:enemy-return',
} as const;

/** The enemies' guide: the sample world with the player as an actor and only the five enemy tactics. */
async function enemyGuide(): Promise<Bundle> {
  const load = await loadBundle(overlaySource(await createFsBundleSource(SAMPLE_DIR), await createFsBundleSource(ENEMY_GUIDE)), await schemaRegistry());
  assert.deepEqual(load.issues, []);
  return { ...load.bundle, tactics: load.bundle.tactics.filter(({ doc }) => doc.id.startsWith('tactic:bestia:enemy-')) };
}

/** Trusts authored tactics only and nothing else: the guide's data decides. */
const REFLEX = testPersona({ weights: { distance: 0, hp: 0, time: 0, resource: 0, confidence: 1, metrics: 0, intent: 0, exploration: 0 }, exploration_rate: 0, hysteresis: 0, reaction_delay_ticks: 0, misplay_rate: 0, min_confidence: 'authored' });

function situation(overrides: { distance: number; hp?: number; node?: string; shot?: boolean; tick?: number }): ObservationFrame {
  return {
    tick: overrides.tick ?? 0,
    t: (overrides.tick ?? 0) / 10,
    source: 'render-tap',
    mode: 'player',
    purpose: 'efficiency',
    self: { pos: [0, 0, 0], hp: { value: overrides.hp ?? 1, knowledge: 'shown' } },
    entities: [{ entity: PLAYER, instance: 0, pos: [0, 0, overrides.distance], confidence: 1 }],
    stage: { id: 'stage:bestia:dome-arena', elapsed: 0, node: overrides.node ?? 'node:mid-ring' },
    events: overrides.shot === true ? [{ kind: 'shot-at' }] : [],
    extra: { reach: 10 },
  };
}

test('the engine with the enemy guide branches like the fixed tree: chase, attack, retreat, dodge, return', async () => {
  const bundle = await enemyGuide();
  const cases: { name: string; frame: ObservationFrame; fixed: keyof typeof TACTIC_OF_STATE }[] = [
    { name: 'foe out of range', frame: situation({ distance: 30 }), fixed: 'chase' },
    { name: 'foe within range', frame: situation({ distance: 6 }), fixed: 'attack' },
    { name: 'wounded with the foe close', frame: situation({ distance: 6, hp: 0.2 }), fixed: 'retreat' },
    { name: 'shot at', frame: situation({ distance: 6, shot: true }), fixed: 'dodge' },
    { name: 'outside the ring', frame: situation({ distance: 6, node: 'node:outside' }), fixed: 'return' },
    { name: 'wounded but the foe far', frame: situation({ distance: 30, hp: 0.2 }), fixed: 'chase' },
  ];
  for (const { name, frame, fixed } of cases) {
    const brain = createEnemyBrain({ bundle, persona: REFLEX }, 1);
    const action = brain.decide(frame);
    assert.equal(brain.lastChoice, TACTIC_OF_STATE[fixed], name);
    assert.ok(Object.keys(action).length > 0, `${name}: an action`);
  }
});

test('a reflex tactic (expect reflex) is proposed again on the next tick', async () => {
  const brain = createEnemyBrain({ bundle: await enemyGuide(), persona: REFLEX }, 1);
  const choices = [0, 1, 2, 3].map((tick) => (brain.decide(situation({ distance: 6, tick })), brain.lastChoice));
  assert.deepEqual(new Set(choices), new Set(['tactic:bestia:enemy-attack']));
});

test('in the sim, two engine-driven enemies and the player: the brains see only within sight and fight like the fixed tree', async () => {
  const guide = await enemyGuide();
  const observed: ObservationFrame[] = [];
  const choices = new Set<string>();
  const brainFor = (seed: number): SimEnemyBrain => {
    const brain = createEnemyBrain({ bundle: guide, persona: REFLEX }, seed);
    return {
      decide(observation) {
        observed.push(observation);
        const action = brain.decide(observation);
        if (brain.lastChoice !== undefined) choices.add(brain.lastChoice);
        return action;
      },
    };
  };
  const play = async (brains: boolean) => {
    const adapter = createSimAdapter({
      bundle: guide,
      mode: 'player',
      purpose: 'efficiency',
      seed: 7,
      ...(brains ? { enemyBrains: { brains: new Map([[1, brainFor(1)], [2, brainFor(2)]]), mode: 'player' as const, playerEntity: PLAYER } } : {}),
    });
    const report = await runDriver({ adapter, decider: createWaitDecider(), mode: 'player', maxTicks: 600 });
    return { report, stats: adapter.stats() };
  };
  const fixed = await play(false);
  const driven = await play(true);
  assert.ok(observed.length > 0);
  for (const observation of observed) {
    assert.deepEqual(findMaskedPointers(observation), []);
    assert.deepEqual(observationBoundaryProblems(observation, []), []);
  }
  assert.ok(choices.has('tactic:bestia:enemy-chase') && choices.has('tactic:bestia:enemy-attack'), [...choices].join(', '));
  assert.ok(driven.stats.damage_taken > 0, 'the engine-driven enemies hurt the waiting player');
  assert.equal(driven.report.result, fixed.report.result, `fixed tree ${fixed.report.result} vs engine ${driven.report.result}`);
});
