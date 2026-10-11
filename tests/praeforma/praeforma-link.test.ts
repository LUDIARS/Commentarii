import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { readPromptTemplate } from '../../src/adapters/llm/read-prompt-template.ts';
import type { Intent } from '@ludiars/commentarii-sdk/types';
import { draftFromDocument } from '../../src/import/spec/draft-from-document.ts';
import { extractPraeformaRef } from '@ludiars/commentarii-sdk/types';
import { verifyIntent } from '../../src/verify/verify-intent.ts';
import { loadSample, REPO_ROOT, schemaRegistry } from '../support/bundles.ts';
import { scriptedLlm } from '../support/import-io.ts';
import { MAIN_RUNS, readFixtureRuns, ROUTE_INTENT, TEACH_INTENT, TIME_INTENT } from '../support/verify.ts';

const UX = join(REPO_ROOT, 'tests', 'fixtures', 'praeforma', 'ux-dome-arena.md');

test('scene / spec IDs come from the front matter first, then markers; --praeforma overrides the scene', async () => {
  const markdown = await readFile(UX, 'utf8');
  assert.deepEqual(extractPraeformaRef(markdown), { scene_id: 'sample-scene-dome-arena', spec_id: 'sample-spec-arena-flow', project_code: 'Bestia' });
  assert.deepEqual(extractPraeformaRef('<!-- praeforma:scene=s1 -->\n<!-- praeforma:spec=p1 -->\n<!-- praeforma:scene=s2 -->'), { scene_id: 's1', spec_id: 'p1' });
  assert.deepEqual(extractPraeformaRef(markdown, 'scene-override'), { scene_id: 'scene-override', spec_id: 'sample-spec-arena-flow', project_code: 'Bestia' });
  assert.equal(extractPraeformaRef('# no reference here'), undefined);
  assert.deepEqual(extractPraeformaRef('# plain', 'only-scene'), { scene_id: 'only-scene' });
  assert.throws(() => extractPraeformaRef('', 'has space'), /not a Praeforma ID/);
});

test('intent import attaches the document reference to every drafted item, never one from the LLM reply', async () => {
  const document = await readFile(UX, 'utf8');
  const reply = { intended: [{ slug: 'fight-center', kind: 'route', path: ['node:mid-ring', 'node:center'], praeforma: { scene_id: 'made-up-by-model' } }, { slug: 'time', kind: 'time', range_sec: [60, 180] }] };
  const registry = await schemaRegistry();
  const request = { kind: 'intent' as const, document, sourceName: 'ux-dome-arena.md', gameId: 'bestia', stageSlug: 'dome-arena', praeforma: extractPraeformaRef(document, 'sample-scene-dome-arena') ?? {} };
  const result = await draftFromDocument(request, { llm: scriptedLlm(JSON.stringify(reply)), readPrompt: readPromptTemplate, registry });
  const intent = result.documents[0]?.doc as Intent;
  assert.deepEqual(intent.intended.map((item) => item.praeforma?.scene_id), ['sample-scene-dome-arena', 'sample-scene-dome-arena']);
  assert.deepEqual(registry.validate('intent', intent), []);
});

test('intents and stages without praeforma still validate; a malformed reference does not', async () => {
  const registry = await schemaRegistry();
  const intent = { stage: 'stage:g:s', intended: [{ id: 'intent:g:s:r', kind: 'route', path: ['node:a', 'node:b'] }], allowed_divergences: [] };
  assert.deepEqual(registry.validate('intent', intent), []);
  const bad = { ...intent, intended: [{ ...intent.intended[0], praeforma: { scene_id: 'has space' } }] };
  assert.notDeepEqual(registry.validate('intent', bad), []);
  const empty = { ...intent, intended: [{ ...intent.intended[0], praeforma: {} }] };
  assert.notDeepEqual(registry.validate('intent', empty), []);
});

test('verify intent reports carry the stage scene and each intent its own scene / spec; feasibility carries the scene', async () => {
  const load = await loadSample();
  const output = verifyIntent({ load, runs: await readFixtureRuns(MAIN_RUNS), unreadable: [] });
  const stage = output.report.stages[0];
  assert.deepEqual(stage?.praeforma, { scene_id: 'sample-scene-dome-arena', project_code: 'Bestia' });
  const byIntent = new Map(stage?.intents.map((verdict) => [verdict.intent, verdict.praeforma]));
  assert.deepEqual(byIntent.get(ROUTE_INTENT), { scene_id: 'sample-scene-dome-arena', spec_id: 'sample-spec-arena-flow' });
  assert.deepEqual(byIntent.get(TEACH_INTENT), { scene_id: 'sample-scene-dome-arena', spec_id: 'sample-spec-kite-tutorial' });
  assert.equal(byIntent.get(TIME_INTENT), undefined);
  const feasibility = output.feasibility.get('feasibility/dome-arena.json');
  assert.equal(feasibility?.praeforma?.scene_id, 'sample-scene-dome-arena');
  assert.deepEqual((await schemaRegistry()).validate('feasibility', feasibility), []);
});
