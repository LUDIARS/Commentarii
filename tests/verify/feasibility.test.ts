import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Intent } from '../../src/domain/documents.ts';
import { buildEngineWorld } from '../../src/engine/world/build-engine-world.ts';
import { assignBands } from '../../src/verify/feasibility/assign-bands.ts';
import { buildFeasibility, type FeasibilityInput } from '../../src/verify/feasibility/build-feasibility.ts';
import { clusterSolutions } from '../../src/verify/feasibility/cluster-solutions.ts';
import { DEFAULT_THRESHOLDS, thresholdsOf } from '../../src/verify/feasibility/thresholds.ts';
import { verifyIntent } from '../../src/verify/verify-intent.ts';
import { loadSample } from '../support/bundles.ts';
import { enemy, frame, SPIDER } from '../support/personas.ts';
import { KITE, MAIN_RUNS, readFixtureRuns, STAGE, trace } from '../support/verify.ts';

const NODES = new Set(['node:center', 'node:mid-ring', 'node:outer-ring', 'node:outside']);
/** The kite tactic's `when` holds: the spider within 19 m and HP under half. */
const KITE_LOOKS_POSSIBLE = frame({ hp: 0.4, entities: [enemy(SPIDER, 2, 10)] });
/** Healthy: the kite tactic is never proposed. */
const KITE_NEVER_PROPOSED = frame({ hp: 0.9, entities: [enemy(SPIDER, 2, 10)] });

async function input(overrides: Partial<FeasibilityInput>): Promise<FeasibilityInput> {
  const load = await loadSample();
  const intent = load.bundle.intents[0]?.doc;
  assert.ok(intent);
  return {
    stage: STAGE,
    stageSlug: 'dome-arena',
    intent,
    traces: [],
    ignoredOmniscient: [],
    world: buildEngineWorld(load.bundle, 'player'),
    playerNodes: NODES,
    thresholds: DEFAULT_THRESHOLDS,
    ...overrides,
  };
}

function kiteSolution(doc: ReturnType<typeof buildFeasibility>) {
  return doc.solutions.find((solution) => solution.tactics.length === 1 && solution.tactics[0] === KITE);
}

test('illusory: generated as a candidate from the player export, never succeeded', async () => {
  const traces = [trace({ run: 'run:a', route: ['node:mid-ring', 'node:outer-ring'], frames: [KITE_LOOKS_POSSIBLE] })];
  const doc = buildFeasibility(await input({ traces }));
  const kite = kiteSolution(doc);
  assert.equal(kite?.visible, true);
  assert.equal(kite?.band, 'illusory');
  assert.deepEqual(kite?.intended, ['intent:bestia:dome-arena:learn-kite']);
});

test('impossible, not illusory, when the candidate is never generated', async () => {
  const traces = [trace({ run: 'run:a', route: ['node:mid-ring', 'node:outer-ring'], frames: [KITE_NEVER_PROPOSED] })];
  const kite = kiteSolution(buildFeasibility(await input({ traces })));
  assert.equal(kite?.visible, false);
  assert.equal(kite?.band, 'impossible');
});

test('a solution that succeeded is never illusory, even when visible', async () => {
  const traces = [
    trace({ run: 'run:a', tactics: [KITE], frames: [KITE_LOOKS_POSSIBLE] }),
    trace({ run: 'run:b', persona: 'expert', tactics: [KITE], frames: [KITE_LOOKS_POSSIBLE] }),
  ];
  const kite = kiteSolution(buildFeasibility(await input({ traces })));
  assert.equal(kite?.band, 'feasible');
  assert.deepEqual(kite?.evidence_runs, ['run:a', 'run:b']);
});

test('feasible needs every judged persona at the threshold; otherwise a success is extreme', async () => {
  const solutions = clusterSolutions('dome-arena', [
    trace({ run: 'run:e1', persona: 'expert', tactics: [KITE] }),
    trace({ run: 'run:n1', persona: 'novice', tactics: [KITE], reached: false, route: ['node:mid-ring'] }),
    trace({ run: 'run:n2', persona: 'novice', tactics: [KITE], reached: false, route: ['node:mid-ring'] }),
  ], []).map((cluster) => ({ ...cluster, visible: true }));
  const [band] = assignBands({ solutions, thresholds: DEFAULT_THRESHOLDS, byDesign: [] });
  assert.equal(band?.band, 'extreme');
  assert.deepEqual(band?.personas.map((persona) => [persona.persona, persona.band]), [['expert', 'feasible'], ['novice', 'illusory']]);
});

test('illusory_by_design is kept apart with its rationale', async () => {
  const base = await input({});
  const intent: Intent = { ...(base.intent as Intent), illusory_by_design: [{ tactics: [KITE], rationale: '釣りの選択肢', decided_by: 'neco' }] };
  const doc = buildFeasibility({ ...base, intent, traces: [trace({ run: 'run:a', route: ['node:mid-ring', 'node:outer-ring'], frames: [KITE_LOOKS_POSSIBLE] })] });
  assert.deepEqual(kiteSolution(doc)?.by_design, { rationale: '釣りの選択肢', decided_by: 'neco' });
});

test('breadth counts successful solutions; convergence only when refined is not declared', async () => {
  const traces = [trace({ run: 'run:a', tactics: [KITE], frames: [KITE_LOOKS_POSSIBLE] })];
  const open = buildFeasibility(await input({ traces }));
  assert.deepEqual(open.axes.map((axis) => [axis.persona, axis.breadth, axis.convergence]), [['novice', 1, true]]);
  const base = await input({ traces });
  const refined = buildFeasibility({ ...base, intent: { ...(base.intent as Intent), design_stance: 'refined' } });
  assert.equal(refined.axes[0]?.convergence, false);
  assert.equal(refined.design_stance, 'refined');
});

test('confusion depth weighs failures on illusory solutions, stalling and off-route nodes', async () => {
  const traces = [
    trace({ run: 'run:ok', route: ['node:mid-ring', 'node:center'] }),
    trace({ run: 'run:fail', reached: false, tactics: [KITE], route: ['node:mid-ring', 'node:outer-ring'], stallSec: 20, frames: [KITE_LOOKS_POSSIBLE] }),
  ];
  const doc = buildFeasibility(await input({ traces }));
  // run:ok 0; run:fail = illusory_weight 3 + 20 s x 0.1 + 1 node off the intended route = 6; mean 3.
  assert.equal(doc.axes[0]?.confusion_depth, 3);
});

test('omniscient runs neither band a solution nor count (fixture)', async () => {
  const load = await loadSample();
  const output = verifyIntent({ load, runs: await readFixtureRuns(MAIN_RUNS), unreadable: [] });
  const doc = output.feasibility.get('feasibility/dome-arena.json');
  assert.ok(doc);
  assert.deepEqual(doc.runs.ignored_omniscient, ['run:verify-omni-expert']);
  assert.ok(!doc.runs.counted.includes('run:verify-omni-expert'));
  for (const solution of doc.solutions) assert.ok(!solution.evidence_runs.includes('run:verify-omni-expert'));
  assert.ok(!doc.solutions.some((solution) => solution.route.includes('node:outside') && solution.route.length === 3), 'the omniscient route mid-ring -> outside -> center forms no solution');
});

test('thresholds come from the manifest field by field', () => {
  assert.deepEqual(thresholdsOf(undefined), DEFAULT_THRESHOLDS);
  const manifest = { game_id: 'g', title: { en: 'g' }, version: '1', coordinates: { system: 'grid' as const, unit: 'cell' }, feasibility: { thresholds: { feasible_success: 0.8 } } };
  assert.deepEqual(thresholdsOf(manifest), { ...DEFAULT_THRESHOLDS, feasible_success: 0.8 });
});
