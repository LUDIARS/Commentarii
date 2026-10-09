import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditMask } from '../../src/audit/audit-mask.ts';
import { DEFAULT_EXTENSIONS } from '../../src/audit/audit-config.ts';
import { looksBinary, selectScanTargets } from '../../src/audit/scan-targets.ts';
import { auditGuideConfig, loadAuditGuide, memoryScanSource, readGameFiles } from './support.ts';

test('default targets are chosen by extension; node_modules, dist and .git are excluded', () => {
  const paths = [
    'ui/en.json',
    'ui/en.po',
    'ui/Strings.resx',
    'net/state.proto',
    'net/state.d.ts',
    'src/Save.cs',
    'src/log.cpp',
    'src/log.h',
    'README.md',
    'art/icon.png',
    'node_modules/lib/index.js',
    'dist/main.js',
    '.git/config.json',
    'web/node_modules/x/y.json',
  ];
  assert.deepEqual(selectScanTargets(paths, DEFAULT_EXTENSIONS), paths.slice(0, 8));
});

test('manifest audit.scan.extensions replaces the default list', () => {
  assert.deepEqual(selectScanTargets(['a.json', 'b.lua', 'c.ts'], ['.lua']), ['b.lua']);
});

test('binary files are skipped even with a scanned extension', async () => {
  assert.equal(looksBinary('PK\u0003\u0004\u0000\u0000'), true);
  assert.equal(looksBinary('{ "a": 1 }'), false);
  const config = await auditGuideConfig();
  const source = memoryScanSource({ 'game/save.json': '\u0000\u0001 420 N wire_ambush_b', 'game/ui.json': '{ "t": "tension 420 N" }' });
  const files = await readGameFiles(config, source, ['game']);
  assert.deepEqual(files.map((file) => file.path), ['game/ui.json']);
  const report = auditMask({ load: await loadAuditGuide(), config, files });
  assert.deepEqual(report.hits.map((hit) => [hit.file, hit.ref]), [['game/ui.json', 'enemy:bestia:wire-spider.stats.web_tension']]);
});
