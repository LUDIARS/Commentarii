import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import type { DraftLlm } from '../../src/import/spec/draft-llm.ts';
import { schemaRegistry } from '../support/bundles.ts';
import { copySample, readJson, removeTempDir, SAMPLE_CSV, SAMPLE_GRID, SAMPLE_MAPPING, scriptedLlm, testImportIo } from '../support/import-io.ts';

const directories: string[] = [];
after(async () => {
  for (const directory of directories) await removeTempDir(directory);
});

async function bundleCopy(): Promise<string> {
  const directory = await copySample();
  directories.push(directory);
  return directory;
}

interface Run {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function guide(argv: string[], llm?: DraftLlm): Promise<Run> {
  let stdout = '';
  let stderr = '';
  const io: CliIo = {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    openBundle: openBundleDir,
    writeFiles: writeOutputFiles,
    openReplay: openReplayFile,
    importIo: testImportIo(llm),
    scanSource: fsScanSource,
  };
  const code = await runCli(argv, io);
  return { code, stdout, stderr };
}

async function entityFiles(bundle: string): Promise<string[]> {
  return (await readdir(join(bundle, 'entities', 'enemies'))).sort();
}

test('import masters into an empty bundle, then validate passes every check', async () => {
  const bundle = await bundleCopy();
  for (const file of await entityFiles(bundle)) await removeTempDir(join(bundle, 'entities', 'enemies', file));
  const imported = await guide(['import', 'masters', '--game', bundle, '--from', SAMPLE_CSV, '--map', SAMPLE_MAPPING]);
  assert.equal(imported.code, 0, imported.stderr);
  assert.deepEqual(await entityFiles(bundle), [
    'bazooka-beetle.json',
    'bazooka-beetle.masked.json',
    'bomber-dragonfly.json',
    'wire-spider.json',
  ]);
  const publicText = await readFile(join(bundle, 'entities', 'enemies', 'bazooka-beetle.json'), 'utf8');
  assert.doesNotMatch(publicText, /masked|body_mass|aim_lead_divisor/);
  const masked = await readJson(join(bundle, 'entities', 'enemies', 'bazooka-beetle.masked.json'));
  assert.deepEqual(Object.keys((masked as { stats: object }).stats), ['body_mass', 'aim_lead_divisor']);

  const validated = await guide(['validate', bundle]);
  assert.equal(validated.code, 0, validated.stdout);
  assert.equal(validated.stdout.match(/^OK {3}V\d\d /gm)?.length, 12, validated.stdout);
});

test('import masters over the hand-written sample keeps it valid; --dry-run writes nothing', async () => {
  const bundle = await bundleCopy();
  const before = await readFile(join(bundle, 'entities', 'enemies', 'wire-spider.json'), 'utf8');
  const dry = await guide(['import', 'masters', '--game', bundle, '--from', SAMPLE_CSV, '--map', SAMPLE_MAPPING, '--dry-run']);
  assert.equal(dry.code, 0, dry.stderr);
  assert.match(dry.stdout, /~ entities\/enemies\/wire-spider\.json\n {4}~ \/stats\/health\/source\/ref: "Bestia src\/world\.cpp archetype\[1\]" -> "archetypes\.csv#row=2"/);
  assert.equal(await readFile(join(bundle, 'entities', 'enemies', 'wire-spider.json'), 'utf8'), before);

  assert.equal((await guide(['import', 'masters', '--game', bundle, '--from', SAMPLE_CSV, '--map', SAMPLE_MAPPING])).code, 0);
  const spider = (await readJson(join(bundle, 'entities', 'enemies', 'wire-spider.json'))) as { weak_to: unknown[] };
  assert.equal(spider.weak_to.length, 1, 'the human weak_to survives');
  assert.equal((await guide(['validate', bundle])).code, 0);
  const again = await guide(['import', 'masters', '--game', bundle, '--from', SAMPLE_CSV, '--map', SAMPLE_MAPPING, '--dry-run']);
  assert.equal(again.stdout, 'no changes\n');
});

test('import masters reports bad input without writing', async () => {
  const bundle = await bundleCopy();
  const csv = join(bundle, 'masters', 'unknown.csv');
  await writeFile(csv, 'slug\nx\n', 'utf8');
  const run = await guide(['import', 'masters', '--game', bundle, '--from', csv, '--map', SAMPLE_MAPPING]);
  assert.equal(run.code, 1);
  assert.match(run.stderr, /guide import masters: mapping\.json has no tables\.unknown/);
});

test('import map --kind grid writes a schema-valid stages/<slug>/map.json', async () => {
  const bundle = await bundleCopy();
  const run = await guide(['import', 'map', '--game', bundle, '--stage', 'ring', '--from', SAMPLE_GRID, '--kind', 'grid', '--map', SAMPLE_MAPPING, '--neighbors', '8']);
  assert.equal(run.code, 0, run.stderr);
  const map = await readJson(join(bundle, 'stages', 'ring', 'map.json'));
  assert.deepEqual((await schemaRegistry()).validate('map', map), []);
  assert.equal((map as { stage: string }).stage, 'stage:bestia:ring');
});

test('import map navgraph / zones validate their input and refuse to replace a human map', async () => {
  const bundle = await bundleCopy();
  const navgraph = join(bundle, 'masters', 'nav.json');
  await writeFile(navgraph, JSON.stringify({ nodes: [{ id: 'a', pos: [0, 0, 0] }, { id: 'b', pos: [1, 0, 0] }], edges: [{ from: 'a', to: 'b' }] }), 'utf8');
  assert.equal((await guide(['import', 'map', '--game', bundle, '--stage', 'nav', '--from', navgraph, '--kind', 'navgraph'])).code, 0);
  assert.deepEqual((await schemaRegistry()).validate('map', await readJson(join(bundle, 'stages', 'nav', 'map.json'))), []);

  const zones = join(bundle, 'masters', 'zones.json');
  await writeFile(zones, JSON.stringify({ zones: [{ id: 'a', rect: { min: [0, 0, 0], max: [2, 0, 2] } }], adjacency: [] }), 'utf8');
  assert.equal((await guide(['import', 'map', '--game', bundle, '--stage', 'zoned', '--from', zones, '--kind', 'zones'])).code, 0);
  assert.deepEqual((await schemaRegistry()).validate('map', await readJson(join(bundle, 'stages', 'zoned', 'map.json'))), []);

  const human = await guide(['import', 'map', '--game', bundle, '--stage', 'dome-arena', '--from', zones, '--kind', 'zones']);
  assert.equal(human.code, 1);
  assert.match(human.stderr, /comes from human/);

  await writeFile(zones, JSON.stringify({ zones: [{ id: 'a' }], adjacency: [] }), 'utf8');
  const invalid = await guide(['import', 'map', '--game', bundle, '--stage', 'zoned', '--from', zones, '--kind', 'zones']);
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /does not match import-zones\.schema\.json/);
});

test('import spec and intent import write drafts through the LLM port', async () => {
  const bundle = await bundleCopy();
  const spec = join(bundle, 'masters', 'battle.md');
  await writeFile(spec, '弾が迫ったら回避する。リング外に居座らせない。', 'utf8');
  const machine = { slug: 'dodge-loop', name: { ja: '回避' }, initial: 'idle', states: [{ id: 'idle' }, { id: 'dodge' }], transitions: [{ from: 'idle', to: 'dodge', on: '弾が迫る' }] };
  const states = await guide(['import', 'spec', '--game', bundle, '--from', spec, '--kind', 'states'], scriptedLlm(JSON.stringify({ states: [machine] })));
  assert.equal(states.code, 0, states.stderr);
  const drafted = (await readJson(join(bundle, 'mechanics', 'states', 'dodge-loop.json'))) as { draft: boolean; knowledge: string };
  assert.equal(drafted.draft, true);
  assert.equal(drafted.knowledge, 'masked');

  const intentReply = { intended: [{ slug: 'stay-in', kind: 'forbid', area: 'node:outside' }] };
  const intent = await guide(['intent', 'import', '--game', bundle, '--stage', 'dome-arena', '--from', spec], scriptedLlm(JSON.stringify(intentReply)));
  assert.equal(intent.code, 0);
  assert.match(intent.stderr, /kept intent\/dome-arena\.json \(not a draft/);

  const fresh = await guide(['intent', 'import', '--game', bundle, '--stage', 'ring', '--from', spec], scriptedLlm(JSON.stringify(intentReply)));
  assert.equal(fresh.code, 0, fresh.stderr);
  const written = (await readJson(join(bundle, 'intent', 'ring.json'))) as { draft: boolean; source: { kind: string } };
  assert.equal(written.draft, true);
  assert.equal(written.source.kind, 'llm-draft');
});

test('import usage errors exit 2', async () => {
  for (const argv of [
    ['import'],
    ['import', 'masters', '--game', 'x', '--from', 'y'],
    ['import', 'map', '--game', 'x', '--stage', 'Bad', '--from', 'y', '--kind', 'grid'],
    ['import', 'map', '--game', 'x', '--stage', 's', '--from', 'y', '--kind', 'hex'],
    ['import', 'spec', '--game', 'x', '--from', 'y', '--kind', 'tactics'],
    ['intent', 'edit'],
  ]) {
    const run = await guide(argv);
    assert.equal(run.code, 2, argv.join(' '));
    assert.match(run.stderr, /usage:/);
  }
});
