import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClaudeCliLlm } from '../../../src/adapters/llm/claude-cli-llm.ts';
import { readPromptTemplate } from '../../../src/adapters/llm/read-prompt-template.ts';
import { fillPrompt } from '../../../src/import/spec/fill-prompt.ts';

const VALUES = { game_id: 'g', stage_id: 'stage:g:s', source_name: 'spec.md', document: 'text', problems: '- p' };

test('every prompt template exists and fills completely', async () => {
  for (const name of ['import-spec-rules', 'import-spec-states', 'intent-import', 'retry']) {
    const filled = fillPrompt(await readPromptTemplate(name), VALUES);
    assert.doesNotMatch(filled, /\{\{/, name);
  }
  const rules = fillPrompt(await readPromptTemplate('import-spec-rules'), VALUES);
  assert.match(rules, /数値は仕様書に書かれているものだけ/);
  await assert.rejects(readPromptTemplate('../package'), /invalid prompt name/);
});

test('the claude -p adapter fails loudly when the executable is missing', async () => {
  const llm = createClaudeCliLlm({ command: 'commentarii-no-such-claude-binary' });
  await assert.rejects(llm.complete('hello'), /COMMENTARII_CLAUDE_BIN/);
});
