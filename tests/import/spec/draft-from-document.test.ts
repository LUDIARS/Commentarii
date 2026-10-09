import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPromptTemplate } from '../../../src/adapters/llm/read-prompt-template.ts';
import type { Intent, Rule } from '../../../src/domain/documents.ts';
import { ImportError } from '../../../src/import/import-error.ts';
import { draftFromDocument } from '../../../src/import/spec/draft-from-document.ts';
import type { DraftRequest } from '../../../src/import/spec/draft-request.ts';
import { planDraftWrites } from '../../../src/import/spec/plan-draft-writes.ts';
import { schemaRegistry } from '../../support/bundles.ts';
import { scriptedLlm, type ScriptedLlm } from '../../support/import-io.ts';

const SPEC = `# 回避
弾が最接近するまでの時間 closing_time (0〜5 秒) を見て、0.45 秒以内なら避け始める。例: 0.3 秒。
瀕死の判定は体力の割合で決める。`;

const request = (kind: DraftRequest['kind'], document = SPEC): DraftRequest => ({
  kind,
  document,
  sourceName: 'battle.md',
  gameId: 'bestia',
  ...(kind === 'intent' ? { stageSlug: 'dome-arena' } : {}),
});

async function deps(llm: ScriptedLlm) {
  return { llm, readPrompt: readPromptTemplate, registry: await schemaRegistry() };
}

const documentedRule = {
  slug: 'dodge-window',
  name: { ja: '回避の猶予' },
  expression: 'clamp(closing_time, 0, 0.45)',
  result_unit: 's',
  variables: { closing_time: { unit: 's', range: [0, 5], example: 0.3 } },
};

test('rules: the draft is always draft, llm-draft and masked, whatever the model claims', async () => {
  const llm = scriptedLlm(JSON.stringify({ rules: [{ ...documentedRule, knowledge: 'shown', draft: false, source: { kind: 'human', ref: 'x' } }] }));
  const result = await draftFromDocument(request('rules'), await deps(llm));
  assert.equal(result.documents.length, 1);
  const document = result.documents[0];
  assert.equal(document?.path, 'mechanics/rules/dodge-window.json');
  const rule = document?.doc as Rule;
  assert.equal(rule.id, 'rule:bestia:dodge-window');
  assert.equal(rule.draft, true);
  assert.equal(rule.knowledge, 'masked');
  assert.deepEqual(rule.source, { kind: 'llm-draft', ref: 'battle.md' });
  assert.match(llm.prompts[0] ?? '', /closing_time \(0〜5 秒\)/, 'the document is in the prompt');
});

test('rules: a rule carrying a number the document does not contain is left out', async () => {
  const guessed = { ...documentedRule, slug: 'wounded', expression: 'hp_ratio * 0.25', variables: { hp_ratio: { range: [0, 1], example: 0.5 } } };
  const llm = scriptedLlm(`\`\`\`json\n${JSON.stringify({ rules: [documentedRule, guessed] })}\n\`\`\``);
  const result = await draftFromDocument(request('rules'), await deps(llm));
  assert.deepEqual(result.documents.map((document) => document.path), ['mechanics/rules/dodge-window.json']);
  assert.equal(result.skipped[0]?.id, 'rule:bestia:wounded');
  assert.match(result.skipped[0]?.reason ?? '', /0\.25/);
  assert.doesNotMatch(JSON.stringify(result.documents), /0\.25/);
});

test('an invalid reply is retried once with its problems, then fails', async () => {
  const fixed = scriptedLlm('not json at all', JSON.stringify({ rules: [documentedRule] }));
  const result = await draftFromDocument(request('rules'), await deps(fixed));
  assert.equal(result.documents.length, 1);
  assert.equal(fixed.prompts.length, 2);
  assert.match(fixed.prompts[1] ?? '', /前回の出力の問題[\s\S]*no JSON object/);

  const broken = scriptedLlm(JSON.stringify({ rules: [{ slug: 'x' }] }), JSON.stringify({ rules: [{ slug: 'Bad Slug' }] }));
  await assert.rejects(draftFromDocument(request('rules'), await deps(broken)), ImportError);
  assert.equal(broken.prompts.length, 2);
});

test('states: drafted state machines are draft and masked', async () => {
  const machine = {
    slug: 'battle-ai',
    name: { ja: '戦闘 AI' },
    initial: 'chase',
    states: [{ id: 'chase' }, { id: 'dodge' }],
    transitions: [{ from: 'chase', to: 'dodge', on: '弾が迫る' }],
  };
  const result = await draftFromDocument(request('states'), await deps(scriptedLlm(JSON.stringify({ states: [machine] }))));
  const doc = result.documents[0]?.doc as { id: string; draft: boolean; knowledge: string; source: { kind: string } };
  assert.equal(doc.id, 'state:bestia:battle-ai');
  assert.equal(doc.draft, true);
  assert.equal(doc.knowledge, 'masked');
  assert.equal(doc.source.kind, 'llm-draft');
});

test('intent: items are masked, divergences start empty, undocumented time ranges are dropped', async () => {
  const document = '中央に寄って乱戦になってほしい。リング外に居座らせない。想定は 60 秒から 180 秒。';
  const reply = {
    intended: [
      { slug: 'fight-center', kind: 'route', path: ['node:mid-ring', 'node:center'], knowledge: 'shown' },
      { slug: 'time', kind: 'time', range_sec: [60, 180] },
      { slug: 'guess', kind: 'time', range_sec: [30, 90] },
    ],
    allowed_divergences: [{ run: 'run:x', summary: 'x', decided_by: 'model' }],
  };
  const result = await draftFromDocument(request('intent', document), await deps(scriptedLlm(JSON.stringify(reply))));
  const intent = result.documents[0]?.doc as Intent;
  assert.equal(result.documents[0]?.path, 'intent/dome-arena.json');
  assert.equal(intent.stage, 'stage:bestia:dome-arena');
  assert.equal(intent.draft, true);
  assert.equal(intent.source?.kind, 'llm-draft');
  assert.deepEqual(intent.allowed_divergences, []);
  assert.deepEqual(intent.intended.map((item) => item.id), ['intent:bestia:dome-arena:fight-center', 'intent:bestia:dome-arena:time']);
  assert.ok(intent.intended.every((item) => item.knowledge === 'masked'));
  assert.deepEqual(result.skipped.map((skip) => skip.id), ['intent:bestia:dome-arena:guess']);
});

test('drafts never overwrite a document a human owns', async () => {
  const result = await draftFromDocument(request('rules'), await deps(scriptedLlm(JSON.stringify({ rules: [documentedRule] }))));
  const human = new Map<string, unknown>([['mechanics/rules/dodge-window.json', { id: 'rule:bestia:dodge-window', draft: false }]]);
  assert.deepEqual(planDraftWrites(result.documents, human), { changes: [], protectedPaths: ['mechanics/rules/dodge-window.json'] });
  const earlierDraft = new Map<string, unknown>([['mechanics/rules/dodge-window.json', { id: 'rule:bestia:dodge-window', draft: true }]]);
  assert.equal(planDraftWrites(result.documents, earlierDraft).changes.length, 1);
});
