import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectUnknownSignatures } from '../../src/render-tap/collect-unknown-signatures.ts';
import { formatSignatureReport } from '../../src/render-tap/format-signature-report.ts';
import { buildSignatureIndex } from '../../src/render-tap/identify-appearance.ts';
import { isTapEnd, type TapFrame, type TapLine } from '../../src/render-tap/render-frame.ts';
import { parseReportSignaturesCommand } from '../../src/render-tap/cli/report-signatures-command.ts';
import { REPO_ROOT } from '../support/bundles.ts';

const GOLDEN = join(REPO_ROOT, 'tests', 'fixtures', 'render-tap', 'golden-v1.jsonl');

async function goldenFrames(): Promise<TapFrame[]> {
  const lines = (await readFile(GOLDEN, 'utf8')).split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line) as TapLine);
  return lines.filter((line): line is TapFrame => !isTapEnd(line));
}

const SPIDER = { entity: 'enemy:bestia:wire-spider', mesh: 'mesh:bestia:wire_spider', material: ['mat:bestia:spider_a'] };

test('only visibly drawn scene appearances the guide cannot name are reported', async () => {
  const frames = await goldenFrames();
  const named = collectUnknownSignatures(frames, buildSignatureIndex([SPIDER]));
  assert.ok(named.frames_read > 0);
  // the spider is named; shadow passes and occluded / frustum-only draws never count
  assert.equal(named.appearances.some((a) => a.mesh === SPIDER.mesh), false);
  assert.equal(named.appearances.some((a) => a.mesh === 'mesh:bestia:bomber_dragonfly' || a.mesh === 'mesh:bestia:bazooka_beetle'), false);
  assert.ok(named.appearances.some((a) => a.kind === 'unidentifiable'), 'the count-hash draw asks the maker for asset names');
  const unnamed = collectUnknownSignatures(frames, buildSignatureIndex([]));
  assert.ok(unnamed.appearances.some((a) => a.kind === 'unknown-signature' && a.mesh === SPIDER.mesh));
  for (const appearance of unnamed.appearances) assert.ok(appearance.frames >= 1 && appearance.max_instances >= 1);
});

test('look-alikes are reported as ambiguous with their candidates', async () => {
  const twin = { ...SPIDER, entity: 'enemy:bestia:wire-spider-twin' };
  const report = collectUnknownSignatures(await goldenFrames(), buildSignatureIndex([SPIDER, twin]));
  const ambiguous = report.appearances.find((a) => a.kind === 'ambiguous');
  assert.deepEqual(ambiguous?.candidates, ['enemy:bestia:wire-spider', 'enemy:bestia:wire-spider-twin']);
  const markdown = formatSignatureReport(report, 'bestia');
  assert.match(markdown, /内部資料/);
  assert.match(markdown, /material を分ける/);
});

test('report signatures arguments', () => {
  assert.throws(() => parseReportSignaturesCommand([GOLDEN]), /--game/);
  assert.deepEqual(parseReportSignaturesCommand([GOLDEN, '--game', 'g', '--json']), { name: 'report-signatures', framesPath: GOLDEN, gameDir: 'g', json: true });
});
