import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildIngameExport } from '../../src/export/build-ingame-export.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import { loadSample, SAMPLE_DIR } from '../support/bundles.ts';
import { testImportIo } from '../support/import-io.ts';

const SPIDER = 'enemy:bestia:wire-spider';

test('only shown values by default; a discoverable value appears once the player unlocked it; masked never', async () => {
  const load = await loadSample();
  const locked = buildIngameExport(load, new Set());
  const spider = locked.encyclopedia.find((entry) => entry.id === SPIDER);
  assert.deepEqual(spider?.stats, { radius: { value: 1.5, unit: spider?.stats.radius?.unit } });
  const unlocked = buildIngameExport(load, new Set([`${SPIDER}.stats.health`, 'enemy:bestia:bazooka-beetle.stats.body_mass']));
  assert.equal(unlocked.encyclopedia.find((entry) => entry.id === SPIDER)?.stats.health?.value, 140);
  const text = JSON.stringify(unlocked);
  assert.equal(text.includes('body_mass'), false, 'a masked value is not unlocked by naming it');
  assert.equal(text.includes('aim_lead_divisor'), false);
  assert.equal(unlocked.format, 'commentarii-ingame');
});

test('a teach intent becomes a tutorial line only when the item is shown or unlocked', async () => {
  const load = await loadSample();
  assert.deepEqual(buildIngameExport(load, new Set()).tutorial, [], 'the sample teach item states no knowledge: masked by default');
  const teach = 'intent:bestia:dome-arena:learn-kite';
  const viaUnlock = buildIngameExport(load, new Set([teach]));
  assert.equal(viaUnlock.tutorial.length, 0, 'unlocking applies to discoverable items only');
  const shown = {
    ...load,
    bundle: {
      ...load.bundle,
      intents: load.bundle.intents.map((located) => ({ ...located, doc: { ...located.doc, intended: located.doc.intended.map((item) => (item.id === teach ? { ...item, knowledge: 'shown' as const } : item)) } })),
    },
  };
  const lines = buildIngameExport(shown, new Set()).tutorial;
  assert.deepEqual(lines.map((line) => [line.intent, line.tactic, line.note]), [[teach, 'tactic:bestia:kite-wire-spider', '射程差で下がることを覚えてほしい']]);
  assert.equal(lines[0]?.tactic_name?.en, 'Kite the wire spider');
});

test('guide export --target ingame writes ingame.json from --unlocked; --knowledge full is refused', async () => {
  const out = await mkdtemp(join(tmpdir(), 'cm-ingame-'));
  try {
    const unlocked = join(out, 'unlocked.json');
    await writeFile(unlocked, JSON.stringify({ unlocked: [`${SPIDER}.stats.speed`] }));
    let err = '';
    const io = { stdout: () => {}, stderr: (text: string) => void (err += text), openBundle: openBundleDir, writeFiles: writeOutputFiles, openReplay: openReplayFile, importIo: { ...testImportIo(), readText: (path: string) => readFile(path, 'utf8') }, scanSource: fsScanSource };
    assert.equal(await runCli(['export', SAMPLE_DIR, '--out', join(out, 'dist'), '--target', 'ingame', '--unlocked', unlocked], io), 0, err);
    const written = JSON.parse(await readFile(join(out, 'dist', 'ingame.json'), 'utf8')) as { encyclopedia: { id: string; stats: Record<string, { value: number }> }[] };
    assert.equal(written.encyclopedia.find((entry) => entry.id === SPIDER)?.stats.speed?.value, 8);
    assert.equal(await runCli(['export', SAMPLE_DIR, '--out', join(out, 'x'), '--target', 'ingame', '--knowledge', 'full'], io), 2);
    assert.equal(await runCli(['export', SAMPLE_DIR, '--out', join(out, 'x'), '--unlocked', unlocked], io), 2);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
