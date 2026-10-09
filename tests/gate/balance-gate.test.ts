import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadPersona } from '../../src/adapters/fs/load-persona.ts';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { createReplayFileWriter } from '../../src/adapters/fs/replay-file-writer.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { createFsVerifyIo } from '../../src/adapters/fs/verify-io-fs.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { createFsLearnIo } from '../../src/learn/io/fs-learn-io.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import type { BenchResult } from '../../src/bench/bench-result.ts';
import { runBench } from '../../src/bench/run-bench.ts';
import { toBenchResult } from '../../src/bench/to-bench-result.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import { DEFAULT_BENCH_THRESHOLDS } from '../../src/gate/bench-thresholds.ts';
import { compareBench } from '../../src/gate/compare-bench.ts';
import { DECISION_REGRESSION_NOTE, decisionRegression } from '../../src/gate/decision-regression.ts';
import { gateBalance } from '../../src/gate/gate-balance.ts';
import { createRecordedDecider } from '../../src/replay/recorded-decider.ts';
import type { ReplayRun } from '../../src/replay/replay-record.ts';
import { loadSample, schemaRegistry } from '../support/bundles.ts';
import { shippedPersona } from '../support/personas.ts';
import { testImportIo } from '../support/import-io.ts';
import { withSampleCopy } from '../support/verify.ts';
import { BASE_RUN, BRANCH_RUN, loadRun, REPLAY_FIXTURE_DIR } from '../replay/replay-fixtures.ts';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;

function result(overrides: { metrics?: Partial<BenchResult['metrics']>; compatibility?: Partial<BenchResult['compatibility']>; versions?: Partial<BenchResult['versions']>; divergences?: BenchResult['divergences'] } = {}): BenchResult {
  return {
    format: 'bench-result/1',
    kind: 'live-balance',
    evidence: 'sim',
    game_id: 'bestia',
    compatibility: { adapter: 'commentarii-sim', persona: 'expert', persona_hash: HASH('a'), seed: 1, seeds: [11, 12], runs: 2, ticks: 600, mode: 'player', purpose: 'efficiency', decision_mode: 'player-knowledge', tactics: 'guide', ...overrides.compatibility },
    versions: { manifest_version: '0.1.0', game_builds: ['main'], bundle_hash: HASH('b'), overlay_hash: null, engine_version: '0.1.0', ...overrides.versions },
    metrics: { clear_rate: 1, clear_interval: [0.34, 1], time_p50: 20, time_p90: 22, damage_p50: 10, tactic_share: {}, ...overrides.metrics },
    divergences: overrides.divergences ?? null,
    per_run: [],
  };
}

test('only metrics past their threshold become experience-block candidates', () => {
  const base = result();
  const head = result({ versions: { bundle_hash: HASH('c') }, metrics: { clear_rate: 0.95, time_p50: 25, damage_p50: 11 } });
  const comparison = compareBench(base, head, DEFAULT_BENCH_THRESHOLDS);
  assert.equal(comparison.comparable, true);
  assert.deepEqual(comparison.changed, ['bundle_hash']);
  assert.deepEqual(comparison.metrics.map((metric) => [metric.metric, metric.change, metric.exceeded]), [['clear_rate', -0.05, false], ['time_p50', 0.25, true], ['time_p90', 0, false], ['damage_p50', 0.1, false]]);
  assert.equal(comparison.candidates.length, 1);
  assert.match(comparison.candidates[0] ?? '', /time_p50/);
});

test('a new undesirable divergence of a coverage bench is a candidate', () => {
  const coverage = { purpose: 'coverage' as const };
  const base = result({ compatibility: coverage, divergences: { classes: { match: 2 }, undesirable: ['div-aaaaaaaaaaaa'] } });
  const head = result({ compatibility: coverage, divergences: { classes: { match: 1, undesirable: 1 }, undesirable: ['div-aaaaaaaaaaaa', 'div-bbbbbbbbbbbb'] } });
  const comparison = compareBench(base, head, DEFAULT_BENCH_THRESHOLDS);
  assert.deepEqual(comparison.new_undesirable, ['div-bbbbbbbbbbbb']);
  assert.match(comparison.candidates.join('\n'), /div-bbbbbbbbbbbb/);
});

test('results that differ in persona, seeds, budget, purpose or decision mode are refused, with no metric shown', () => {
  for (const compatibility of [{ persona_hash: HASH('d') }, { seeds: [11, 13] }, { ticks: 900 }, { purpose: 'coverage' as const }, { decision_mode: 'intent-assisted' as const }, { adapter: 'bestia-api' }]) {
    const comparison = compareBench(result(), result({ compatibility }), DEFAULT_BENCH_THRESHOLDS);
    assert.equal(comparison.comparable, false, JSON.stringify(compatibility));
    assert.deepEqual(comparison.metrics, []);
    assert.deepEqual(comparison.candidates, []);
    assert.ok(comparison.incompatibilities.length > 0);
  }
});

test('the gate fails on candidates only with --fail-on block, and always on incomparable results', () => {
  const candidates = compareBench(result(), result({ metrics: { clear_rate: 0.5 } }), DEFAULT_BENCH_THRESHOLDS);
  assert.deepEqual([gateBalance(candidates, 'block').fail, gateBalance(candidates, 'none').fail], [true, false]);
  const clean = compareBench(result(), result(), DEFAULT_BENCH_THRESHOLDS);
  assert.deepEqual([gateBalance(clean, 'block').status, gateBalance(clean, 'block').fail], ['pass', false]);
  const incomparable = compareBench(result(), result({ compatibility: { seeds: [1] } }), DEFAULT_BENCH_THRESHOLDS);
  assert.deepEqual([gateBalance(incomparable, 'none').status, gateBalance(incomparable, 'none').fail], ['incomparable', true]);
  assert.ok(gateBalance(clean, 'block').limits.some((limit) => /not that the experience was verified/.test(limit)));
});

test('decision regression replays recorded runs: match rate and the divergent runs, never a balance result', async () => {
  const [base, branch] = await Promise.all([loadRun(BASE_RUN), loadRun(BRANCH_RUN)]);
  const regression = decisionRegression([base, branch], () => createRecordedDecider(base));
  assert.equal(regression.kind, 'decision-regression');
  assert.equal(regression.evidence, 'replay');
  assert.equal(regression.note, DECISION_REGRESSION_NOTE);
  assert.deepEqual([regression.runs, regression.matched_runs, regression.run_match_rate], [2, 1, 0.5]);
  assert.deepEqual(regression.divergent, [{ run_id: branch.header.run_id, tick: 5 }]);
  assert.ok((regression.tick_match_rate ?? 0) > 0.5 && (regression.tick_match_rate ?? 1) < 1);
});

test('a live bench becomes a schema-valid result with its comparability key and no names or paths', async () => {
  const { bundle } = await loadSample();
  const persona = await shippedPersona('expert');
  const runs: ReplayRun[] = [];
  const report = await runBench({ bundle, persona, seed: 3, runs: 2, ticks: 400, mode: 'player', purpose: 'coverage', onRun: (run) => void runs.push(run) });
  assert.equal(runs.length, 2);
  assert.equal(runs[0]?.footer.type, 'footer');
  const saved = toBenchResult({ report, persona, adapter: 'commentarii-sim', intentAssist: false, manifestVersion: '0.1.0', gameBuilds: ['main'], bundleHash: HASH('e'), overlayHash: null, engineVersion: '0.1.0', divergences: { classes: {}, undesirable: [] } });
  assert.deepEqual((await schemaRegistry()).validate('bench-result', saved), []);
  assert.deepEqual(saved.compatibility.seeds, report.per_run.map((run) => run.seed));
  const text = JSON.stringify(saved);
  for (const leak of ['E:', '\\\\', '/Users/', '/home/', 'samples/', persona.name.en ?? '#']) assert.equal(text.includes(leak), false, leak);
});

function capture(): { io: CliIo; stdout: () => string; stderr: () => string } {
  let out = '';
  let err = '';
  return {
    io: {
      stdout: (text) => (out += text),
      stderr: (text) => (err += text),
      openBundle: openBundleDir,
      writeFiles: writeOutputFiles,
      openReplay: openReplayFile,
      importIo: testImportIo(),
      scanSource: fsScanSource,
      verifyIo: createFsVerifyIo(),
      learnIo: createFsLearnIo(),
      engineIo: { loadPersona, createReplayWriter: createReplayFileWriter, openStdioChannel: () => { throw new Error('no stdio'); }, now: () => new Date(0), engineVersion: async () => '0.1.0' },
    },
    stdout: () => out,
    stderr: () => err,
  };
}

async function cli(args: readonly string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = capture();
  const code = await runCli([...args], io.io);
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

test('guide bench --save, bench compare and gate balance: a weakened guide is caught, other seeds are refused', async () => {
  await withSampleCopy(async (directory) => {
    const bench = (save: string, seed = '1') => cli(['bench', '--game', directory, '--persona', 'expert', '--runs', '3', '--ticks', '600', '--seed', seed, '--save', save]);
    assert.equal((await bench('bench/base.json')).code, 0);
    const saved = JSON.parse(await readFile(join(directory, 'bench', 'base.json'), 'utf8')) as BenchResult;
    assert.deepEqual([saved.kind, saved.evidence, saved.versions.engine_version, saved.divergences], ['live-balance', 'sim', '0.1.0', null]);

    // Head: the kite tactic weakened (it now only waits), and zero thresholds so any worsening counts.
    // Measured on these seeds: time p50 20.6 -> 21.6 s, damage p50 110.4 -> 122.7 (sim).
    const kitePath = join(directory, 'tactics', 'kite-wire-spider.json');
    const kite = JSON.parse(await readFile(kitePath, 'utf8')) as Record<string, unknown>;
    await writeFile(kitePath, JSON.stringify({ ...kite, do: [{ wait: 3 }, { wait: 3 }] }));
    const manifestPath = join(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    await writeFile(manifestPath, JSON.stringify({ ...manifest, bench: { thresholds: { time_p50_increase: 0, time_p90_increase: 0, clear_rate_drop: 0, damage_p50_increase: 0 } } }));
    assert.equal((await bench('bench/head.json')).code, 0);

    const compare = await cli(['bench', 'compare', join(directory, 'bench', 'base.json'), join(directory, 'bench', 'head.json'), '--game', directory, '--json']);
    assert.equal(compare.code, 0, compare.stderr);
    const comparison = JSON.parse(compare.stdout) as { comparable: boolean; changed: string[] };
    assert.equal(comparison.comparable, true);
    assert.ok(comparison.changed.includes('bundle_hash'));

    const gate = await cli(['gate', 'balance', '--game', directory, '--base', join(directory, 'bench', 'base.json'), '--head', join(directory, 'bench', 'head.json')]);
    assert.match(gate.stdout, /evidence: sim/);
    assert.match(gate.stdout, /この判定が示さないこと/);
    const none = await cli(['gate', 'balance', '--game', directory, '--base', join(directory, 'bench', 'base.json'), '--head', join(directory, 'bench', 'head.json'), '--fail-on', 'none']);
    assert.equal(none.code, 0);
    assert.equal(gate.code, 1, gate.stdout);
    assert.match(gate.stdout, /体験ブロック候補あり/);

    assert.equal((await bench('bench/other-seed.json', '2')).code, 0);
    const refused = await cli(['gate', 'balance', '--game', directory, '--base', join(directory, 'bench', 'base.json'), '--head', join(directory, 'bench', 'other-seed.json'), '--fail-on', 'none']);
    assert.equal(refused.code, 1);
    assert.match(refused.stdout, /比較不能/);
    assert.match(refused.stdout, /seed differs/);
  });
});

test('guide bench replay reports a decision regression over recorded runs', async () => {
  await withSampleCopy(async (directory) => {
    const replay = await cli(['bench', 'replay', '--game', directory, '--runs', REPLAY_FIXTURE_DIR, '--json']);
    assert.equal(replay.code, 0, replay.stderr);
    const regression = JSON.parse(replay.stdout) as { kind: string; runs: number; note: string };
    assert.deepEqual([regression.kind, regression.runs, regression.note], ['decision-regression', 2, DECISION_REGRESSION_NOTE]);
  });
});
