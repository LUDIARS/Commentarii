import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { createFsVerifyIo } from '../../src/adapters/fs/verify-io-fs.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import { wellFormedProblems } from '../../src/render/heatmap/well-formed.ts';
import type { DivergenceStore } from '../../src/verify/intent/divergence-store.ts';
import type { VerifyReport } from '../../src/verify/report/verify-report.ts';
import { testImportIo } from '../support/import-io.ts';
import { MAIN_RUNS, ROUTE_INTENT, SEALED_RUNS, withSampleCopy } from '../support/verify.ts';

/** Words that would turn the convergence fact into advice (design 8.5: no recommendation). */
const ADVICE = ['推奨', 'すべき', 'べきです', '洗練化しましょう', '望ましい設計', 'recommend', 'should'];

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
    },
    stdout: () => out,
    stderr: () => err,
  };
}

async function run(args: readonly string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = capture();
  const code = await runCli([...args], io.io);
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

/** Text of every canonical file (overlay and derived feasibility excluded). */
async function canonicalTexts(directory: string): Promise<Map<string, string>> {
  const names = (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1).replaceAll('\\', '/'))
    .filter((path) => !path.startsWith('observations/') && !path.startsWith('feasibility/'))
    .sort();
  return new Map(await Promise.all(names.map(async (path) => [path, await readFile(join(directory, path), 'utf8')] as const)));
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

test('verify intent writes the overlay side only; --accept writes the intent and the divergence is not reported again', async () => {
  await withSampleCopy(async (directory) => {
    const before = await canonicalTexts(directory);
    const first = await run(['verify', 'intent', '--game', directory, '--runs', MAIN_RUNS, '--json']);
    assert.equal(first.code, 0, first.stderr);
    const report = JSON.parse(first.stdout) as VerifyReport;
    assert.deepEqual(report.runs.ignored_omniscient, ['run:verify-omni-expert']);
    assert.ok(report.runs.unreadable.some((path) => path.endsWith('not-a-replay.jsonl')));
    assert.deepEqual(await canonicalTexts(directory), before, 'verification never writes the canonical bundle');

    const store = await readJson<DivergenceStore>(join(directory, 'observations', 'divergences.json'));
    assert.equal(store.divergences.length, 3);
    assert.ok(store.divergences.every((entry) => entry.decision === 'pending'));
    const alt = store.divergences.find((entry) => entry.reason === 'alt-route');
    assert.ok(alt);

    const accept = await run(['verify', 'intent', '--game', directory, '--accept', alt.id, '--by', 'neco', '--note', '別解として残す']);
    assert.equal(accept.code, 0, accept.stderr);
    assert.match(accept.stdout, /昇格候補/);
    assert.match(accept.stdout, /tactic:bestia:kite-wire-spider--reorder/);
    const after = await canonicalTexts(directory);
    for (const [path, text] of before) if (path !== 'intent/dome-arena.json') assert.equal(after.get(path), text, `${path} must not change`);
    const intent = JSON.parse(after.get('intent/dome-arena.json') ?? '{}') as { allowed_divergences: { divergence?: string; decided_by: string }[] };
    assert.deepEqual(intent.allowed_divergences.map((entry) => [entry.divergence, entry.decided_by]), [[alt.id, 'neco']]);
    assert.equal(after.get('tactics/kite-wire-spider.json'), before.get('tactics/kite-wire-spider.json'), 'promotion is reported, not applied');

    const again = await run(['verify', 'intent', '--game', directory, '--runs', MAIN_RUNS, '--json']);
    assert.equal(again.code, 0, again.stderr);
    const second = JSON.parse(again.stdout) as VerifyReport;
    const stage = second.stages[0];
    assert.ok(stage);
    assert.ok(!stage.divergences.some((divergence) => divergence.id === alt.id), 'an accepted divergence is not reported again');
    assert.deepEqual(stage.accepted.map((entry) => entry.id), [alt.id]);
    assert.equal(stage.intents.find((verdict) => verdict.intent === ROUTE_INTENT)?.classification, 'match');
    const stored = await readJson<DivergenceStore>(join(directory, 'observations', 'divergences.json'));
    const kept = stored.divergences.find((entry) => entry.id === alt.id);
    assert.equal(kept?.decision, 'allow');
    assert.equal(kept?.note, '別解として残す');

    const twice = await run(['verify', 'intent', '--game', directory, '--accept', alt.id, '--by', 'neco']);
    assert.equal(twice.code, 0, twice.stderr);
    assert.match(twice.stdout, /変更なし/);

    const validate = await run(['validate', directory]);
    assert.equal(validate.code, 0, validate.stdout);
  });
});

test('the report, heatmaps and feasibility files are written and well-formed', async () => {
  await withSampleCopy(async (directory) => {
    const result = await run(['verify', 'intent', '--game', directory, '--runs', MAIN_RUNS]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /## stage:bestia:dome-arena/);
    assert.match(result.stdout, /!\[.*\]\(dome-arena\.heatmap\.svg\)/);
    const verifyDir = join(directory, 'observations', 'verify');
    assert.deepEqual((await readdir(verifyDir)).sort(), ['dome-arena.heatmap.svg', 'good-play.svg', 'report.json', 'report.md']);
    const heatmap = await readFile(join(verifyDir, 'dome-arena.heatmap.svg'), 'utf8');
    assert.deepEqual(wellFormedProblems(heatmap), []);
    assert.match(heatmap, /class="forbid" data-node="node:outside"/);
    assert.match(heatmap, /class="run-path"/);
    assert.match(heatmap, /class="intent-route"/);
    assert.match(heatmap, /data-group="human"/);
    assert.deepEqual(wellFormedProblems(await readFile(join(verifyDir, 'good-play.svg'), 'utf8')), []);
    assert.equal(await readFile(join(verifyDir, 'report.md'), 'utf8'), result.stdout);
    const feasibility = await readJson<{ runs: { counted: string[] } }>(join(directory, 'feasibility', 'dome-arena.json'));
    assert.ok(!feasibility.runs.counted.includes('run:verify-omni-expert'));
  });
});

test('convergence is reported as a fact without recommending refinement', async () => {
  await withSampleCopy(async (directory) => {
    const verify = await run(['verify', 'intent', '--game', directory, '--runs', MAIN_RUNS]);
    assert.equal(verify.code, 0, verify.stderr);
    assert.match(verify.stdout, /成功した解法は 1 つに収束している/);
    const feasibility = await run(['report', 'feasibility', '--game', directory]);
    assert.equal(feasibility.code, 0, feasibility.stderr);
    assert.match(feasibility.stdout, /成功した解法は 1 つに収束している/);
    for (const text of [verify.stdout, feasibility.stdout]) for (const word of ADVICE) assert.ok(!text.includes(word), `report contains '${word}'`);
  });
});

test('sealed runs: unreproduced intents stay measurements; sealing the map proves the route impossible', async () => {
  await withSampleCopy(async (directory) => {
    const measured = await run(['verify', 'intent', '--game', directory, '--runs', SEALED_RUNS, '--json']);
    assert.equal(measured.code, 0, measured.stderr);
    const classesOf = (stdout: string) => (JSON.parse(stdout) as VerifyReport).stages[0]?.intents.map((verdict) => verdict.classification);
    assert.deepEqual(classesOf(measured.stdout), ['not-reproduced', 'not-reproduced', 'match', 'match']);

    const mapPath = join(directory, 'stages', 'dome-arena', 'map.json');
    const map = JSON.parse(await readFile(mapPath, 'utf8')) as { edges: { from: string; to: string }[] };
    await writeFile(mapPath, JSON.stringify({ ...map, edges: map.edges.filter((edge) => edge.from !== 'node:center' && edge.to !== 'node:center') }));
    const sealed = await run(['verify', 'intent', '--game', directory, '--runs', SEALED_RUNS, '--json']);
    assert.equal(sealed.code, 0, sealed.stderr);
    assert.deepEqual(classesOf(sealed.stdout), ['impossible', 'not-reproduced', 'match', 'match'], 'the walled route is proven; the taught tactic still exists');
    const report = await run(['report', 'feasibility', '--game', directory]);
    assert.equal(report.code, 0, report.stderr);
    const rows = report.stdout.split('\n').filter((line) => line.startsWith('| ') && line.includes('stage:bestia:dome-arena') && line.includes('sol:'));
    assert.ok(rows.length > 0);
    assert.doesNotMatch(rows.join('\n'), /^\| illusory/m, 'a handful of sealed runs is not enough evidence for illusory');
  });
});

test('guide render embeds the heatmap and bands when a verification report exists', async () => {
  await withSampleCopy(async (directory) => {
    const outDir = join(directory, 'observations', 'rendered');
    const plain = await run(['render', directory, '--out', outDir]);
    assert.equal(plain.code, 0, plain.stderr);
    assert.doesNotMatch(await readFile(join(outDir, 'stages', 'dome-arena.md'), 'utf8'), /ヒートマップ/);
    assert.equal((await run(['verify', 'intent', '--game', directory, '--runs', MAIN_RUNS])).code, 0);
    assert.equal((await run(['render', directory, '--out', outDir])).code, 0);
    const page = await readFile(join(outDir, 'stages', 'dome-arena.md'), 'utf8');
    assert.match(page, /## 経路・死亡ヒートマップと行動可能性/);
    assert.match(page, /!\[経路・死亡ヒートマップ\]\(dome-arena\.heatmap\.svg\)/);
    assert.deepEqual(wellFormedProblems(await readFile(join(outDir, 'stages', 'dome-arena.heatmap.svg'), 'utf8')), []);
  });
});

test('usage and input errors', async () => {
  assert.equal((await run(['verify', 'intent', '--game', 'x'])).code, 2, 'runs are required');
  assert.equal((await run(['verify', 'intent', '--game', 'x', '--accept', 'div-000000000000'])).code, 2, '--by is required');
  await withSampleCopy(async (directory) => {
    const missing = await run(['verify', 'intent', '--game', directory, '--runs', join(directory, 'nope')]);
    assert.equal(missing.code, 1);
    assert.match(missing.stderr, /not found/);
    const noStore = await run(['verify', 'intent', '--game', directory, '--accept', 'div-000000000000', '--by', 'neco']);
    assert.equal(noStore.code, 1);
    assert.equal((await run(['verify', 'intent', '--game', directory, '--runs', MAIN_RUNS])).code, 0);
    const unknown = await run(['verify', 'intent', '--game', directory, '--accept', 'div-000000000000', '--by', 'neco']);
    assert.equal(unknown.code, 1);
    assert.match(unknown.stderr, /is not in observations\/divergences\.json/);
  });
});
