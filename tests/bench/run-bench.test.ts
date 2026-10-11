import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runBench, type BenchOptions } from '../../src/bench/run-bench.ts';
import type { BenchReport } from '../../src/bench/summarize-bench.ts';
import { loadSample } from '../support/bundles.ts';
import { shippedPersona } from '../support/personas.ts';

const RUNS = 20;

async function bench(slug: string, overrides: Partial<BenchOptions> = {}): Promise<BenchReport> {
  const { bundle } = await loadSample();
  return runBench({ bundle, persona: await shippedPersona(slug), seed: 1, runs: RUNS, ticks: 2000, mode: 'player', purpose: 'efficiency', ...overrides });
}

// Measured without the intent-assisted test (Astra review P1-4): the designer's intent is not
// handed to the decider. In the sim the guide's tactics shorten the expert's clear time; for the
// novice (authored tactics only, slow reactions) they do not (recorded in
// spec/tasks/2026-10-09-astra-review-completion.md). Sim evidence only, not a claim about people.
test('generic actions alone still play the sample through; the guide\'s tactics do better for the expert', async () => {
  const guided = await bench('expert');
  const generic = await bench('expert', { withoutTactics: true });
  assert.equal(generic.tactics, 'none');
  assert.deepEqual(generic.tactic_share, {});
  assert.ok(generic.clear_rate > 0, 'generic actions alone still clear some runs');
  assert.ok(generic.per_run.every((run) => run.ticks > 0));
  assert.ok((guided.tactic_share['tactic:bestia:kite-wire-spider'] ?? 0) > 0, 'the guided runs use the kite tactic');
  const guidedTime = guided.time_sec?.mean ?? Number.POSITIVE_INFINITY;
  const genericTime = generic.time_sec?.mean ?? Number.POSITIVE_INFINITY;
  assert.ok(
    guided.clear_rate > generic.clear_rate || (guided.clear_rate === generic.clear_rate && guidedTime < genericTime),
    `guided clear ${guided.clear_rate} / ${guidedTime}s vs generic ${generic.clear_rate} / ${genericTime}s`,
  );
});

test('novice, expert and explorer decide differently: explorers adopt exploration candidates most', async () => {
  const [novice, expert, explorer] = await Promise.all(['novice', 'expert', 'explorer'].map((slug) => bench(slug)));
  assert.ok(novice && expert && explorer);
  assert.ok(explorer.exploration_share > expert.exploration_share, `explorer ${explorer.exploration_share} vs expert ${expert.exploration_share}`);
  assert.ok(explorer.exploration_share > novice.exploration_share, `explorer ${explorer.exploration_share} vs novice ${novice.exploration_share}`);
  assert.notDeepEqual(novice.candidate_share, expert.candidate_share);
});

test('a bench is reproducible and its report is consistent', async () => {
  const a = await bench('expert', { runs: 3 });
  const b = await bench('expert', { runs: 3 });
  assert.deepEqual(a, b);
  assert.equal(a.per_run.length, 3);
  assert.equal(new Set(a.per_run.map((run) => run.seed)).size, 3, 'each run has its own seed');
  assert.ok(a.clear_rate >= 0 && a.clear_rate <= 1);
  await assert.rejects(bench('expert', { runs: 0 }), /positive integer/);
});
