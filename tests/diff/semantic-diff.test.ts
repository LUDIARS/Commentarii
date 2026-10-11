import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { LoadResult } from '@ludiars/commentarii-sdk/types';
import { parseDiffCommand } from '../../src/diff/diff-command.ts';
import { formatDiffMarkdown } from '../../src/diff/format-diff-markdown.ts';
import { runDiffCommand } from '../../src/diff/run-diff-command.ts';
import { semanticDiff, type RecordChange } from '../../src/diff/semantic-diff.ts';
import { buildExport } from '../../src/export/build-export.ts';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { loadSample, SAMPLE_DIR } from '../support/bundles.ts';

const BEETLE = 'enemy:bestia:bazooka-beetle';
const KITE = 'tactic:bestia:kite-wire-spider';
const KITE_V2 = 'tactic:bestia:kite-wire-spider-v2';
const TIME = 'stage:bestia:dome-arena#intent:bestia:dome-arena:time';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The sample, then: beetle health 180 -> 200, speed discoverable -> shown, a masked value changed,
 *  kite tactic replaced by a v2, and the intended time range widened. */
function edited(load: LoadResult): LoadResult {
  const next = structuredClone(load) as LoadResult;
  const bundle = next.bundle as unknown as Json;
  const beetle = bundle.entities.find((e: Json) => e.doc.id === BEETLE).doc;
  beetle.stats.health.value = 200;
  beetle.stats.speed.knowledge = 'shown';
  bundle.maskedEntities.find((e: Json) => e.doc.id === BEETLE).doc.stats.body_mass.value = 20;
  const kite = bundle.tactics.find((t: Json) => t.doc.id === KITE);
  kite.doc.superseded_by = KITE_V2;
  bundle.tactics.push({ path: 'tactics/kite-v2.json', doc: { ...structuredClone(kite.doc), id: KITE_V2, superseded_by: null } });
  const time = bundle.intents[0].doc.intended.find((i: Json) => i.kind === 'time');
  time.range_sec = [60, 240];
  return next;
}

function find(changes: readonly RecordChange[], kind: RecordChange['kind'], id: string): RecordChange | undefined {
  return changes.find((change) => change.kind === kind && change.id === id);
}

test('value changes carry the numbers, boundary promotions and replacements are named', async () => {
  const load = await loadSample();
  const diff = semanticDiff(buildExport(load, { knowledge: 'full', target: 'runtime' }), buildExport(edited(load), { knowledge: 'full', target: 'runtime' }));
  const beetle = find(diff.changes, 'changed', BEETLE);
  assert.ok(beetle?.kind === 'changed');
  assert.deepEqual(beetle.fields.find((f) => f.pointer === '/stats/health'), { kind: 'value', pointer: '/stats/health', before: 180, after: 200, delta: 20 });
  assert.deepEqual(beetle.fields.find((f) => f.pointer === '/stats/speed'), { kind: 'boundary', pointer: '/stats/speed', before: 'discoverable', after: 'shown', direction: 'promoted' });
  assert.deepEqual(find(diff.changes, 'replaced', KITE), { kind: 'replaced', record: 'tactic', id: KITE, by: KITE_V2 });
  assert.ok(find(diff.changes, 'added', KITE_V2));
  const time = find(diff.changes, 'changed', TIME);
  assert.ok(time?.kind === 'changed');
  assert.deepEqual(time.fields, [{ kind: 'value', pointer: '/range_sec', before: [60, 180], after: [60, 240] }]);
  assert.ok(find(diff.changes, 'changed', BEETLE) && diff.changes.some((c) => c.record === 'masked-entity'));
  const markdown = formatDiffMarkdown(diff);
  assert.match(markdown, /`\/stats\/health`: `180` → `200` \(\+20\)/);
  assert.match(markdown, /境界の昇格 discoverable → shown/);
  assert.match(markdown, /内部用/);
});

test('the public (player) diff never carries a masked value', async () => {
  const load = await loadSample();
  const diff = semanticDiff(buildExport(load, { knowledge: 'player', target: 'runtime' }), buildExport(edited(load), { knowledge: 'player', target: 'runtime' }));
  assert.equal(diff.changes.some((c) => c.record === 'masked-entity'), false);
  assert.doesNotMatch(JSON.stringify(diff), /body_mass|"masked"/);
  assert.match(formatDiffMarkdown(diff), /公開用/);
});

test('the same guide has no change, and mixed knowledge is refused', async () => {
  const load = await loadSample();
  const player = buildExport(load, { knowledge: 'player', target: 'runtime' });
  assert.deepEqual(semanticDiff(player, player).changes, []);
  assert.match(formatDiffMarkdown(semanticDiff(player, player)), /意味のある変更はありません/);
  assert.throws(() => semanticDiff(player, buildExport(load, { knowledge: 'full', target: 'runtime' })), /cannot diff/);
});

test('guide diff --explain from the command line', async () => {
  assert.throws(() => parseDiffCommand([SAMPLE_DIR, SAMPLE_DIR]), /--explain/);
  assert.throws(() => parseDiffCommand(['--explain', SAMPLE_DIR]), /exactly/);
  const directory = await mkdtemp(join(tmpdir(), 'cm-diff-'));
  try {
    let out = '';
    const io = {
      stdout: (text: string) => { out += text; },
      stderr: () => {},
      openBundle: openBundleDir,
      writeFiles: writeOutputFiles,
    };
    assert.equal(await runDiffCommand(parseDiffCommand(['--explain', SAMPLE_DIR, SAMPLE_DIR]), io), 0);
    assert.match(out, /意味のある変更はありません/);
    const file = join(directory, 'diff.md');
    assert.equal(await runDiffCommand(parseDiffCommand(['--explain', SAMPLE_DIR, SAMPLE_DIR, '--out', file, '--knowledge', 'full']), io), 0);
    assert.match(await readFile(file, 'utf8'), /内部用/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
