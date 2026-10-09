import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { ingestRuns } from '../../src/learn/ingest/ingest-runs.ts';
import type { LearningPolicy } from '../../src/learn/policy/learning-policy.ts';
import { BEETLE_ID, CLOSE, driftedPolicy, KITE, loadDrifted, readRuns, SPIDER_ID } from '../support/learn.ts';

async function ingest(names: readonly string[], rewrite: Partial<LearningPolicy['rewrite']> = {}) {
  const load = await loadDrifted();
  const before = structuredClone(load.bundle);
  const result = ingestRuns({ bundle: load.bundle, gameId: 'bestia', policy: driftedPolicy(load, { rewrite }), overlay: undefined, runs: await readRuns(...names) });
  assert.ok(isDeepStrictEqual(load.bundle, before), 'ingest never changes the canonical bundle');
  return result;
}

test('a drifted value is detected against the canonical one, with count and agreement', async () => {
  const { report } = await ingest(['drift-a', 'drift-b']);
  const spider = report.value_drifts.find((drift) => drift.entity === SPIDER_ID);
  assert.deepEqual(spider, {
    entity: SPIDER_ID,
    quantity: 'hp',
    ref: `${SPIDER_ID}.stats.health`,
    canonical: 100,
    knowledge: 'discoverable',
    runs: 2,
    estimates: 2,
    mean: 139.5,
    agreement: 0,
    drifted: true,
  });
  const beetle = report.value_drifts.find((drift) => drift.entity === BEETLE_ID);
  assert.equal(beetle?.knowledge, 'masked', 'resolved in the .masked.json');
  assert.equal(beetle?.drifted, false);
});

test('unknown entities, failing tactics and measured variants are listed', async () => {
  const { report, overlay } = await ingest(['drift-a']);
  assert.deepEqual(report.unknown_entities, [{ key: 'enemy:bestia:ghost-moth', entity: 'enemy:bestia:ghost-moth', draft: 'entities/enemies/ghost-moth.json', runs: 1, sightings: 1 }]);
  assert.deepEqual(overlay.mismatches, [{ tactic: `${KITE}--reorder`, count: 1, runs: ['run:drift-a'] }]);
  const close = overlay.tactics.find((entry) => entry.tactic === CLOSE);
  assert.deepEqual(close?.metrics, { runs: 4, success: 1, time_sec: { p50: 3, p90: 3 }, risk: { damage_taken_p50: 8 } });
});

test('a variant becomes a rewrite candidate only when it meets min_runs and min_gain', async () => {
  const { report, overlay } = await ingest(['drift-a']);
  const verdicts = Object.fromEntries(report.variants.map((entry) => [entry.tactic, entry.meets]));
  assert.deepEqual(verdicts, { [`${CLOSE}--substitute`]: true, [`${KITE}--reorder`]: false, [`${KITE}--substitute`]: true });
  assert.equal(report.variants.find((entry) => entry.tactic === `${CLOSE}--substitute`)?.gain, 0.5);
  assert.deepEqual(overlay.rewrites.map((rewrite) => [rewrite.tactic.id, rewrite.tactic.confidence, rewrite.evidence]), [
    [`${CLOSE}--substitute`, 'learned', ['run:drift-a']],
    [`${KITE}--substitute`, 'learned', ['run:drift-a']],
  ]);
  assert.equal((await ingest(['drift-a'], { min_runs: 5 })).overlay.rewrites.length, 0, 'below min_runs');
  assert.equal((await ingest(['drift-a'], { min_gain: 0.6 })).overlay.rewrites.length, 0, 'below min_gain');
});

test('omniscient runs are ignored and counted; ingesting a run again counts it once', async () => {
  const load = await loadDrifted();
  const policy = driftedPolicy(load);
  const first = ingestRuns({ bundle: load.bundle, gameId: 'bestia', policy, overlay: undefined, runs: await readRuns('drift-b', 'omni-a', 'omni-b') });
  assert.deepEqual(first.report.runs.ignored_omniscient, ['run:omni-a', 'run:omni-b']);
  assert.deepEqual(first.overlay.runs, { player: ['run:drift-b'], ignored_omniscient: ['run:omni-a', 'run:omni-b'] });
  assert.ok(!first.overlay.tactics.some((entry) => entry.tactic === `${CLOSE}--reorder`), 'omniscient samples are not learned from');
  assert.deepEqual(first.overlay.values.find((entry) => entry.entity === BEETLE_ID)?.estimates, [{ run: 'run:drift-b', value: 182, hits: 7 }]);
  const again = ingestRuns({ bundle: load.bundle, gameId: 'bestia', policy, overlay: first.overlay, runs: await readRuns('drift-b') });
  assert.deepEqual(again.report.runs.already_ingested, ['run:drift-b']);
  assert.deepEqual(again.overlay, first.overlay);
});
