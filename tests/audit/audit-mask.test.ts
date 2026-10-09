import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditMask } from '../../src/audit/audit-mask.ts';
import type { Finding } from '../../src/audit/audit-report.ts';
import { auditGuideConfig, loadAuditGuide, readGameFiles } from './support.ts';

function at(findings: readonly Finding[], fileSuffix: string, ref: string): Finding[] {
  return findings.filter((finding) => finding.file.endsWith(fileSuffix) && finding.ref === ref);
}

async function auditFixture(minNumericLength?: number) {
  const load = await loadAuditGuide();
  const base = await auditGuideConfig();
  const config = minNumericLength === undefined ? base : { ...base, minNumericLength };
  return auditMask({ load, config, files: await readGameFiles(config) });
}

test('value-hit: masked numbers (with unit), strings and ID slugs exposed in UI strings, types and logs', async () => {
  const report = await auditFixture();
  const valueHits = report.hits.filter((finding) => finding.kind === 'value-hit');
  const mass = at(valueHits, 'ui/strings.en.json', 'enemy:bestia:bazooka-beetle.stats.body_mass');
  assert.equal(mass.length, 1);
  assert.equal(mass[0]?.line, 3);
  assert.match(mass[0]?.reason ?? '', /同じ単位/);
  assert.equal(at(valueHits, 'ui/strings.en.json', 'enemy:bestia:bazooka-beetle.stats.aim_lead_divisor').length, 1);
  assert.equal(at(valueHits, 'ui/strings.en.json', 'enemy:bestia:wire-spider.fields.loot_table').length, 1);
  assert.equal(at(valueHits, 'console/combat-log.ts', 'enemy:bestia:bazooka-beetle.stats.aim_lead_divisor').length, 1);
  assert.equal(at(valueHits, 'console/combat-log.ts', 'enemy:bestia:wire-spider.fields.ambush_script').length, 1);
  assert.equal(at(valueHits, 'console/combat-log.ts', 'enemy:bestia:wire-spider.stats.web_tension').length, 1);
  assert.equal(valueHits.length, 6);
});

test('key-hit: forbidden keys as fields, also in camelCase', async () => {
  const report = await auditFixture();
  const keyHits = report.hits.filter((finding) => finding.kind === 'key-hit');
  assert.deepEqual(
    keyHits.map((finding) => [finding.file.split('/').slice(-2).join('/'), finding.line, finding.ref]),
    [
      ['net/enemy-state.d.ts', 5, 'forbidden_keys:drop_rate'],
      ['net/enemy-state.d.ts', 9, 'forbidden_keys:rng_seed'],
    ],
  );
  assert.match(keyHits[1]?.reason ?? '', /camelCase/);
});

test('undefined-exposure: a number the guide does not know in UI text is a warning; known public numbers are not', async () => {
  const report = await auditFixture();
  assert.deepEqual(
    report.warnings.map((finding) => [finding.file.split('/').slice(-2).join('/'), finding.line, finding.ref]),
    [['ui/strings.en.json', 7, 'literal:750']],
  );
  // 180 is the beetle's public health: in the guide, so no warning and no hit.
  assert.equal([...report.hits, ...report.warnings].some((finding) => finding.line === 6 && finding.file.endsWith('strings.en.json')), false);
});

test('allow moves matching findings to allowed[] with the rationale and the decider', async () => {
  const report = await auditFixture();
  assert.equal(report.allowed.length, 2);
  for (const finding of report.allowed) {
    assert.ok(finding.file.endsWith('ui/legacy-hud.json'));
    assert.equal(finding.allow.decided_by, 'neco');
    assert.ok(finding.allow.rationale.length > 0);
  }
  assert.deepEqual(report.allowed.map((finding) => finding.kind).sort(), ['undefined-exposure', 'value-hit']);
  assert.equal([...report.hits, ...report.warnings].some((finding) => finding.file.endsWith('legacy-hud.json')), false);
});

test('summary counts match, only scan targets are read, and the report echoes no masked string', async () => {
  const report = await auditFixture();
  assert.equal(report.summary.game_id, 'bestia');
  assert.equal(report.summary.scanned_files, 4);
  assert.equal(report.summary.hits, 8);
  assert.equal(report.summary.warnings, 1);
  assert.equal(report.summary.allowed, 2);
  assert.deepEqual(report.summary.by_kind, { 'value-hit': 6, 'key-hit': 2, 'undefined-exposure': 1 });
  const all = [...report.hits, ...report.warnings, ...report.allowed];
  assert.equal(all.some((finding) => finding.file.endsWith('notes.txt')), false);
  const text = JSON.stringify(report);
  for (const masked of ['wire_ambush_b', 'silk-gland']) assert.equal(text.includes(masked), false, masked);
});

test('short integers stay below the threshold (default 3 digits)', async () => {
  const report = await auditFixture(3);
  const all = [...report.hits, ...report.warnings, ...report.allowed];
  // 18 kg and 32 have two digits: not compared, so not reported anywhere.
  assert.equal(all.some((finding) => finding.ref.endsWith('.body_mass') || finding.ref.endsWith('.aim_lead_divisor')), false);
  // 420 N has three digits and is still a hit.
  assert.equal(report.hits.filter((finding) => finding.ref.endsWith('.web_tension')).length, 1);
  assert.equal(report.summary.hits, 5);
  assert.deepEqual(report.allowed.map((finding) => finding.ref), ['literal:9071']);
});
