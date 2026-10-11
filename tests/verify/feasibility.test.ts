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

/** n finished failed attempts of the kite solution (distinct runs and seeds). */
function failedKite(n: number, frames = [KITE_LOOKS_POSSIBLE]) {
  return Array.from({ length: n }, (_, index) => trace({ run: `run:f${index}`, seed: index, reached: false, tactics: [KITE], route: ['node:mid-ring', 'node:outer-ring'], frames }));
}

test('success 0 alone is not illusory: too few finished attempts stay insufficient-evidence', async () => {
  const kite = kiteSolution(buildFeasibility(await input({ traces: failedKite(1) })));
  assert.equal(kite?.visible, true);
  assert.equal(kite?.band, 'insufficient-evidence');
  assert.deepEqual([kite?.evidence.attempts, kite?.evidence.successes, kite?.evidence.interval?.[0]], [1, 0, 0]);
  assert.ok((kite?.evidence.interval?.[1] ?? 0) > DEFAULT_THRESHOLDS.zero_success_upper, 'one failure leaves the upper bound high');
});

test('illusory: visible, never succeeded, and enough finished attempts that the 95% upper bound is below zero_success_upper', async () => {
  const kite = kiteSolution(buildFeasibility(await input({ traces: failedKite(16) })));
  assert.equal(kite?.band, 'illusory');
  assert.deepEqual(kite?.intended, ['intent:bestia:dome-arena:learn-kite']);
  assert.equal(kite?.evidence.attempts, 16);
  assert.ok((kite?.evidence.interval?.[1] ?? 1) < 0.2);
  assert.equal(kite?.evidence.seeds.length, 16);
  assert.equal(kite?.evidence.budget_ticks, 900);
});

test('aborted runs are not in the denominator: a solution only aborted runs tried is not-observed', async () => {
  const aborted = failedKite(20).map((entry) => ({ ...entry, completed: false }));
  const kite = kiteSolution(buildFeasibility(await input({ traces: aborted })));
  assert.equal(kite?.band, 'not-observed');
  assert.deepEqual([kite?.evidence.attempts, kite?.evidence.aborted], [0, 20]);
});

test('never generated and never succeeded is not impossible without a map proof; a route off the map is', async () => {
  const kite = kiteSolution(buildFeasibility(await input({ traces: failedKite(16, [KITE_NEVER_PROPOSED]) })));
  assert.equal(kite?.visible, false);
  assert.equal(kite?.band, 'insufficient-evidence');
  const load = await loadSample();
  const map = load.bundle.stages.find((stage) => stage.map?.doc.stage === STAGE)?.map?.doc;
  assert.ok(map);
  const offMap = [trace({ run: 'run:ghost', reached: false, tactics: ['tactic:bestia:sidestep-lead-shot'], route: ['node:mid-ring', 'node:vault'] })];
  const doc = buildFeasibility(await input({ traces: offMap, map }));
  const ghost = doc.solutions.find((solution) => solution.route.includes('node:vault'));
  assert.equal(ghost?.band, 'impossible');
  assert.match(ghost?.unwalkable ?? '', /node:vault is not on the stage map/);
});

test('an intended solution nobody tried is not-observed, not impossible', async () => {
  const doc = buildFeasibility(await input({ traces: [] }));
  const intended = doc.solutions.filter((solution) => solution.intended.length > 0);
  assert.ok(intended.length > 0);
  for (const solution of intended) assert.equal(solution.band, 'not-observed', solution.id);
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

test('the expert succeeds and the novice does not: skill-gated, not feasible; low success everywhere is extreme', async () => {
  const solutions = clusterSolutions('dome-arena', [
    trace({ run: 'run:e1', persona: 'expert', tactics: [KITE] }),
    trace({ run: 'run:n1', persona: 'novice', tactics: [KITE], reached: false, route: ['node:mid-ring'] }),
    trace({ run: 'run:n2', persona: 'novice', tactics: [KITE], reached: false, route: ['node:mid-ring'] }),
  ], []).map((cluster) => ({ ...cluster, visible: true }));
  const [band] = assignBands({ solutions, thresholds: DEFAULT_THRESHOLDS, byDesign: [] });
  assert.equal(band?.band, 'skill-gated');
  assert.deepEqual(band?.personas.map((persona) => [persona.persona, persona.band]), [['expert', 'feasible'], ['novice', 'insufficient-evidence']]);
  const strict = assignBands({ solutions, thresholds: { ...DEFAULT_THRESHOLDS, feasible_success: 1.01 }, byDesign: [] });
  assert.equal(strict[0]?.band, 'extreme');
});

test('illusory_by_design is kept apart with its rationale', async () => {
  const base = await input({});
  const intent: Intent = { ...(base.intent as Intent), illusory_by_design: [{ tactics: [KITE], rationale: '釣りの選択肢', decided_by: 'neco' }] };
  const doc = buildFeasibility({ ...base, intent, traces: failedKite(16) });
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
  // One failure is no proof of an illusory solution (insufficient-evidence): it weighs 1.
  // run:ok 0; run:fail = 1 + 20 s x 0.1 + 1 node off the intended route = 4; mean 2.
  assert.equal(doc.axes[0]?.confusion_depth, 2);
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
