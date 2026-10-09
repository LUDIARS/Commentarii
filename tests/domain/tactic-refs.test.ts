import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Tactic } from '../../src/domain/documents.ts';
import { collectTacticRefs } from '../../src/domain/tactic-refs.ts';

test('references come from when / do / expect / because, bindings are ignored', () => {
  const tactic: Tactic = {
    id: 'tactic:g:t',
    name: { ja: 't' },
    when: { all: [{ entity: 'enemy:g:a', visible: true }] },
    do: [{ move_to: 'node:exit' }, { attack: '$enemy' }],
    expect: { entity_state: { $enemy: 'state:g:s#stunned' } },
    because: ['rule:g:r'],
    knowledge: 'shown',
    confidence: 'authored',
    superseded_by: 'tactic:g:newer',
  };
  assert.deepEqual(collectTacticRefs(tactic), ['enemy:g:a', 'node:exit', 'rule:g:r', 'state:g:s#stunned']);
});
