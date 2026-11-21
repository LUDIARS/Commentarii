import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBundleFromTexts } from '@ludiars/commentarii-sdk/bundle';
import { buildEngineWorld } from '@ludiars/commentarii-sdk/knowledge';
import { parseReplay } from '@ludiars/commentarii-sdk/replay';
import { toPlayerView } from '@ludiars/commentarii-sdk/rulebook';
import type { BenchResult, Intent, Manifest, ReplayFooter, ReplayHeader, Stage } from '@ludiars/commentarii-sdk/types';
import { buildExport, exportFiles } from '../../src/export/build-export.ts';
import { runValidation } from '../../src/validate/run-validation.ts';
import { replaySchema } from '../replay/replay-fixtures.ts';
import { schemaRegistry } from '../support/bundles.ts';

const manifest: Manifest = { game_id: 'g1', title: { en: '1' }, version: '1', coordinates: { system: 'grid', unit: '1' } };
const stage: Stage = {
  id: 'stage:g1:s1', name: { en: '1' },
  objectives: [{ value: { en: '1' }, knowledge: 'shown', source: { kind: 'human', ref: '1' } }],
};
const pair = { action: 'action:g1:a1', target_kind: 'enemy:g1:e1' };
const staged: Stage = {
  ...stage, order: 2, introduces: [pair],
  teaches: (['demonstration', 'safe-trial', 'text'] as const).map((method) => ({ ...pair, method })),
};
const teach = { id: 'intent:g1:s1:i1', kind: 'teach', tactic: 'tactic:g1:t1' } as const;
const intent: Intent = { stage: stage.id, intended: [teach], allowed_divergences: [] };
const hints = [{ when: 'hp(self) < 7', kind: 'rule', target: 'r1' }, { when: 'hp(self) < 3', kind: 'solution', target: 's1' }] as const;
const hinted: Intent = { ...intent, intended: [{ ...teach, hints }] };
const withLevel: Manifest = { ...manifest, level: { profile: 'puzzle', target_persona: '1' } };

async function load(manifestDoc: unknown, stageDoc: unknown, intentDoc: unknown) {
  return loadBundleFromTexts([
    { path: 'manifest.json', text: JSON.stringify(manifestDoc) },
    { path: 'stages/s1/stage.json', text: JSON.stringify(stageDoc) },
    { path: 'intent/s1.json', text: JSON.stringify(intentDoc) },
  ], await schemaRegistry());
}

test('level declarations load and export, and evaluator hints stay out of player and decision input', async () => {
  assert.deepEqual((await load(manifest, stage, intent)).issues, []);
  const result = await load(withLevel, staged, hinted);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.bundle.manifest?.doc, withLevel);
  assert.deepEqual(result.bundle.stages[0]?.stage?.doc, staged);
  assert.deepEqual(result.bundle.intents[0]?.doc, hinted);
  const view = toPlayerView(result.bundle);
  assert.deepEqual(view.stages[0]?.stage?.doc, staged);
  assert.deepEqual(view.intents[0]?.doc, intent);
  for (const mode of ['player', 'omniscient'] as const) {
    assert.deepEqual(buildEngineWorld(result.bundle, mode).stages.get(stage.id)?.intents, [teach]);
  }
  for (const knowledge of ['player', 'full'] as const) {
    const text = exportFiles(buildExport(result, { knowledge, target: 'runtime' })).get('bundle.json');
    assert.ok(text);
    const { documents } = JSON.parse(text);
    assert.deepEqual(documents.manifest.doc, withLevel);
    assert.deepEqual(documents.stages[0].stage.doc, staged);
    assert.deepEqual(documents.intents[0].doc, knowledge === 'full' ? hinted : intent);
  }
});

test('level schemas reject malformed declarations, hints outside teach, and unknown enum values', async () => {
  const registry = await schemaRegistry();
  for (const doc of [
    { ...stage, order: 1.5 }, { ...stage, order: '1' },
    { ...stage, introduces: pair }, { ...stage, introduces: [{ ...pair, action: 'a1' }] },
    { ...stage, introduces: [{ ...pair, target_kind: 'e1' }] },
    { ...stage, teaches: [pair] }, { ...stage, teaches: [{ ...pair, method: 'unknown' }] },
  ]) assert.notDeepEqual(registry.validate('stage', doc), [], JSON.stringify(doc));
  for (const profile of ['general', 'puzzle', 'strategy', 'action']) {
    assert.deepEqual(registry.validate('manifest', { ...manifest, level: { profile } }), []);
  }
  for (const level of [2, { profile: 'unknown' }, { target_persona: 2 }]) {
    assert.notDeepEqual(registry.validate('manifest', { ...manifest, level }), []);
  }
  for (const malformed of [
    { ...hints[0], when: 1 }, { ...hints[0], kind: 'unknown' }, { ...hints[0], target: 1 },
    { when: '1', kind: 'rule' },
  ]) assert.notDeepEqual(registry.validate('intent', { ...intent, intended: [{ ...teach, hints: [malformed] }] }), []);
  assert.notDeepEqual(registry.validate('intent', { ...intent, intended: [{ id: teach.id, kind: 'forbid', area: 'node:n1', hints }] }), []);
});

test('validation checks stage references and expr/2 hint syntax at their source pointers', async () => {
  const result = await load(withLevel, staged, { ...hinted, intended: [{ ...teach, hints: [...hints, { ...hints[0], when: '1 +' }] }] });
  const { checks } = runValidation(result);
  const refs = checks.find(({ id }) => id === 'V02')?.findings;
  assert.ok(refs?.some(({ pointer }) => pointer === '/introduces/0/action'));
  assert.ok(refs?.some(({ pointer }) => pointer === '/teaches/0/target_kind'));
  assert.deepEqual(checks.find(({ id }) => id === 'V12')?.findings.map(({ pointer }) => pointer), [
    '/intended/0/hints/2/when', '/intended/0/tactic',
  ]);
});

test('staged replay and bench results round-trip alongside earlier documents', async () => {
  const registry = await schemaRegistry();
  const hash = `sha256:${'0'.repeat(64)}`;
  const header: ReplayHeader = {
    type: 'header', run_id: 'run:r1', seed: 1, game_id: 'g1', manifest_version: '1', adapter_id: 'a1',
    mode: 'player', purpose: 'efficiency', started_at: '2026-01-01T00:00:00Z',
  };
  const footer: ReplayFooter = { type: 'footer', result: 'success', summary: {}, ended_at: '2026-01-01T00:00:00Z' };
  const schema = await replaySchema();
  const withCurriculum: ReplayHeader = { ...header, curriculum: { kind: 'staged', hash } };
  for (const record of [header, withCurriculum]) {
    const text = [record, footer].map((line) => JSON.stringify(line)).join('\n');
    assert.deepEqual(parseReplay(text, schema), { issues: [], run: { header: record, footer, ticks: [] } });
  }
  assert.notDeepEqual(schema.validateLine({ ...header, curriculum: { kind: 'unknown', hash } }), []);

  const compatibility: BenchResult['compatibility'] = {
    adapter: 'a1', persona: 'p1', persona_hash: hash, seed: 1, seeds: [1], runs: 1, ticks: 1,
    mode: 'player', purpose: 'efficiency', decision_mode: 'player-knowledge', tactics: 'none',
  };
  const bench: BenchResult = {
    format: 'bench-result/1', kind: 'live-balance', evidence: 'sim', game_id: 'g1', compatibility,
    versions: { manifest_version: '1', game_builds: [], bundle_hash: hash, overlay_hash: null, engine_version: '1' },
    metrics: { clear_rate: 1, clear_interval: [0, 1], time_p50: 1, time_p90: 1, damage_p50: 0, tactic_share: {} },
    divergences: null, per_run: [{ seed: 1, result: 'success', ticks: 1, time_sec: 1, damage_taken: 0 }],
  };
  const stagedBench: BenchResult = { ...bench, compatibility: { ...compatibility, curriculum: 'staged', curriculum_hash: hash } };
  for (const record of [bench, stagedBench]) {
    const decoded = JSON.parse(JSON.stringify(record));
    assert.deepEqual(registry.validate('bench-result', decoded), []);
    assert.deepEqual(decoded, record);
  }
  assert.notDeepEqual(registry.validate('bench-result', { ...bench, compatibility: { ...compatibility, curriculum: 'unknown' } }), []);
});
