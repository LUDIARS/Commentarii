import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { HumanCandidates } from '../../../src/import/plays/human-candidates.ts';
import type { PlaysReport } from '../../../src/import/plays/plays-report.ts';
import { copySample, removeTempDir } from '../../support/import-io.ts';
import { BASE_RUN } from '../../replay/replay-fixtures.ts';
import { guide, humanFiles, MASKED_MAPPING, PLAYS_MAPPING, RAW_STRINGS, TELEMETRY_CSV, TELEMETRY_JSONL, TEST_SALT } from './plays-support.ts';

const directories: string[] = [];
after(async () => {
  for (const directory of directories) await removeTempDir(directory);
});

async function bundleCopy(): Promise<string> {
  const directory = await copySample();
  directories.push(directory);
  return directory;
}

function hmac16(salt: string, identifier: string): string {
  return createHmac('sha256', salt).update(identifier, 'utf8').digest('hex').slice(0, 16);
}

const importArgs = (bundle: string, from = TELEMETRY_JSONL, map = PLAYS_MAPPING) => ['import', 'plays', '--game', bundle, '--from', from, '--map', map];

test('import plays writes anonymized human runs under observations/human/<player-hash>/', async () => {
  const bundle = await bundleCopy();
  const result = await guide(importArgs(bundle));
  assert.equal(result.code, 0, result.stderr);
  const files = await humanFiles(bundle);
  const runPaths = [...files.keys()].filter((path) => path.endsWith('.jsonl')).sort();
  assert.equal(runPaths.length, 3);
  const playerDirs = new Set(runPaths.map((path) => path.split('/')[0]));
  assert.deepEqual([...playerDirs].sort(), [hmac16(TEST_SALT, 'player-7781'), hmac16(TEST_SALT, 'player-9902')].sort());
  assert.ok(files.has('candidates.json'));
  for (const path of runPaths) {
    const lines = (files.get(path) ?? '').trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    const header = lines[0] ?? {};
    assert.equal(header.source, 'human');
    assert.equal(header.mode, 'player');
    assert.equal(header.purpose, 'human');
    assert.match(String(header.run_id), /^run:human-[0-9a-f]{16}$/);
  }
  // Free-text and identifying columns are dropped by name, and reported by name only.
  assert.match(result.stderr, /dropped column\(s\) not in the mapping: device_id, email, ip, note, player_name\n/);
  assert.match(result.stderr, /unidentified entities: 1/);
  assert.match(result.stderr, /unmapped inputs: 1/);
  assert.match(result.stderr, /unmapped events: 1/);
});

test('no raw identifier or proper name reaches any output (text search)', async () => {
  const bundle = await bundleCopy();
  const result = await guide(importArgs(bundle));
  assert.equal(result.code, 0, result.stderr);
  const texts = [...(await humanFiles(bundle)).values(), result.stdout, result.stderr];
  for (const raw of RAW_STRINGS) {
    for (const text of texts) assert.equal(text.includes(raw), false, `${raw} leaked`);
  }
});

test('the same identifier and salt give the same hash; another salt gives another', async () => {
  const first = await bundleCopy();
  const second = await bundleCopy();
  const salted = await bundleCopy();
  assert.equal((await guide(importArgs(first))).code, 0);
  assert.equal((await guide(importArgs(second))).code, 0);
  assert.equal((await guide(importArgs(salted), 'another-salt')).code, 0);
  assert.deepEqual(await humanFiles(first), await humanFiles(second));
  const dirs = async (bundle: string) => new Set([...(await humanFiles(bundle)).keys()].filter((path) => path.endsWith('.jsonl')).map((path) => path.split('/')[0]));
  for (const dir of await dirs(salted)) assert.equal((await dirs(first)).has(dir), false);
  // Re-importing the same telemetry rewrites the same files with the same content.
  const before = await humanFiles(first);
  assert.equal((await guide(importArgs(first))).code, 0);
  assert.deepEqual(await humanFiles(first), before);
});

test('without a salt the import fails and writes nothing', async () => {
  const bundle = await bundleCopy();
  const result = await guide(importArgs(bundle), null);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /COMMENTARII_PLAYER_SALT/);
  assert.equal((await humanFiles(bundle)).size, 0);
  const empty = await guide(importArgs(bundle), '');
  assert.equal(empty.code, 1);
  const withArgument = await guide([...importArgs(bundle), '--player-salt', TEST_SALT], null);
  assert.equal(withArgument.code, 0, withArgument.stderr);
});

test('a mapping that lets a masked value into a human observation fails and writes nothing', async () => {
  const bundle = await bundleCopy();
  const result = await guide(importArgs(bundle, TELEMETRY_JSONL, MASKED_MAPPING));
  assert.equal(result.code, 1);
  assert.match(result.stderr, /\/self\/hp would record a masked value/);
  assert.equal((await humanFiles(bundle)).size, 0);

  // A boundary left out defaults to masked, so it fails the same way (principle 1).
  const mapping = JSON.parse(await readFile(PLAYS_MAPPING, 'utf8')) as { self: { resources: { boost: Record<string, unknown> } } };
  delete mapping.self.resources.boost.knowledge;
  const undeclared = join(bundle, 'undeclared-mapping.json');
  await writeFile(undeclared, JSON.stringify({ ...mapping, identify: { table: { SPIDER_W: 'enemy:bestia:wire-spider' } } }));
  const defaulted = await guide(importArgs(bundle, TELEMETRY_JSONL, undeclared));
  assert.equal(defaulted.code, 1);
  assert.match(defaulted.stderr, /\/self\/resources\/boost would record a masked value/);
  assert.equal((await humanFiles(bundle)).size, 0);
});

test('an extra column that carries a raw identifier fails the import', async () => {
  const bundle = await bundleCopy();
  const mapping = JSON.parse(await readFile(PLAYS_MAPPING, 'utf8')) as Record<string, unknown>;
  const leaking = join(bundle, 'leaking-mapping.json');
  await writeFile(leaking, JSON.stringify({ ...mapping, identify: { table: { SPIDER_W: 'enemy:bestia:wire-spider' } }, extra: { who: 'player_id' } }));
  const result = await guide(importArgs(bundle, TELEMETRY_JSONL, leaking));
  assert.equal(result.code, 1);
  assert.match(result.stderr, /holds a raw player or run identifier/);
  assert.equal(result.stderr.includes('player-7781'), false);
  assert.equal((await humanFiles(bundle)).size, 0);
});

test('only action sequences no tactic covers become learned draft candidates', async () => {
  const bundle = await bundleCopy();
  assert.equal((await guide(importArgs(bundle))).code, 0);
  const candidates = JSON.parse((await humanFiles(bundle)).get('candidates.json') ?? '') as HumanCandidates;
  assert.equal(candidates.game_id, 'bestia');
  assert.equal(candidates.runs, 3);
  const shapes = candidates.candidates.map((candidate) => ({ do: candidate.tactic.do, occurrences: candidate.evidence.occurrences, players: candidate.evidence.players }));
  assert.deepEqual(
    shapes.sort((a, b) => JSON.stringify(a.do).localeCompare(JSON.stringify(b.do))),
    [
      { do: [{ attack: '$enemy' }], occurrences: 1, players: 1 },
      { do: [{ custom: 'dash', target: 'node:outside' }, { attack: '$enemy' }], occurrences: 1, players: 1 },
      { do: [{ move_to: 'node:center' }, { attack: '$enemy' }], occurrences: 3, players: 2 },
    ],
  );
  for (const candidate of candidates.candidates) {
    assert.equal(candidate.tactic.confidence, 'learned');
    assert.equal(candidate.tactic.draft, true);
    assert.equal(candidate.source.kind, 'human');
  }
  // Run A1 kites the wire spider exactly as tactic:bestia:kite-wire-spider does: no candidate.
  assert.equal(candidates.candidates.some((candidate) => JSON.stringify(candidate.tactic.do) === JSON.stringify([{ move_to: 'node:outer-ring' }, { attack: '$enemy' }])), false);
  // The canonical tactics are untouched.
  assert.equal((await guide(['validate', bundle])).code, 0);
});

test('CSV telemetry with JSON cells imports the same way', async () => {
  const bundle = await bundleCopy();
  const result = await guide(importArgs(bundle, TELEMETRY_CSV));
  assert.equal(result.code, 0, result.stderr);
  const runs = [...(await humanFiles(bundle)).entries()].filter(([path]) => path.endsWith('.jsonl'));
  assert.equal(runs.length, 1);
  const text = runs[0]?.[1] ?? '';
  assert.match(text, /"entity":"enemy:bestia:wire-spider"/);
  assert.match(text, /"kind":"enemy-defeated"/);
  for (const raw of RAW_STRINGS) assert.equal(text.includes(raw), false, `${raw} leaked`);
});

test('report plays puts human runs next to player-mode autoplay runs per stage', async () => {
  const bundle = await bundleCopy();
  assert.equal((await guide(importArgs(bundle))).code, 0);
  const runsDir = join(bundle, 'observations', 'runs');
  await mkdir(runsDir, { recursive: true });
  await copyFile(BASE_RUN, join(runsDir, 'bestia-dome-base.jsonl'));
  const omniscient = (await readFile(BASE_RUN, 'utf8')).replaceAll('"mode":"player"', '"mode":"omniscient"').replaceAll('"render-tap"', '"game-api"');
  await writeFile(join(runsDir, 'bestia-dome-omniscient.jsonl'), omniscient);
  await writeFile(join(runsDir, 'overlay-lines.jsonl'), '{"t":1,"tick":10,"kind":"mismatch","source":"render-tap","mode":"player","purpose":"efficiency"}\n');

  const json = await guide(['report', 'plays', '--game', bundle, '--json']);
  assert.equal(json.code, 0, json.stderr);
  const report = JSON.parse(json.stdout) as PlaysReport;
  assert.deepEqual(report.human, { runs: 3, players: 2 });
  assert.deepEqual(report.autoplay, { runs: 1, omniscient_excluded: 1 });
  assert.deepEqual(report.skipped_files, ['observations/runs/overlay-lines.jsonl']);
  const [stage] = report.stages;
  assert.equal(report.stages.length, 1);
  assert.equal(stage?.stage, 'stage:bestia:dome-arena');
  assert.equal(stage?.human.runs, 3);
  assert.equal(stage?.human.reached, 2);
  assert.equal(stage?.human.reach_rate, 0.6667);
  assert.deepEqual(stage?.human.time_sec, { p50: 1.5, p90: 2.5 });
  assert.deepEqual(stage?.human.routes.map((route) => route.path), [
    ['node:mid-ring', 'node:center'],
    ['node:mid-ring', 'node:center', 'node:outer-ring'],
    ['node:mid-ring', 'node:center', 'node:outside'],
  ]);
  assert.equal(stage?.autoplay.runs, 1);
  assert.equal(stage?.autoplay.reached, 0);
  assert.equal(stage?.autoplay.time_sec, null);

  const markdown = await guide(['report', 'plays', '--game', bundle]);
  assert.equal(markdown.code, 0);
  assert.match(markdown.stdout, /^# 人間 vs オートプレイヤー/);
  assert.match(markdown.stdout, /\| 到達 \| 2\/3 \(66\.7%\) \| 0\/1 \(0\.0%\) \|/);
});
