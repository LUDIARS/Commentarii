// rulebook.md: variables, every action with its ID and precondition expression, the fsm
// behavior model as a Mermaid stateDiagram, objectives (inclusion checks, not a snapshot). The
// masked override of shoot never reaches the player pages; masked.md (full) shows it.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderBundle } from '../../src/render/render-bundle.ts';
import { loadSample } from '../support/bundles.ts';

test('rulebook.md lists variables, actions with their pre, the fsm diagram and objectives', async () => {
  const load = await loadSample();
  const page = renderBundle(load, { knowledge: 'player' }).get('rulebook.md') ?? '';
  for (const name of ['max_hp', 'ready_at', 'hostile']) assert.ok(page.includes(name), name);
  for (const { doc } of load.bundle.rulebook.actions) {
    assert.ok(page.includes(doc.id), doc.id);
    assert.ok(page.includes(`pre: ${doc.pre}`), `pre of ${doc.id}`);
  }
  assert.match(page, /```mermaid\nstateDiagram-v2/);
  assert.match(page, /chase --> attack : dist\(actor, \$target\) <= range\(actor\)/);
  assert.match(page, /attack : 攻撃 \/ action：bestia：shoot\(target=\$target\)/);
  assert.ok(page.includes('process:bestia:regen'));
  assert.ok(page.includes('count(hostile) == 0'));
  assert.ok(page.includes('sum(hostile, hp)'));
});

test('the masked override reaches masked.md only', async () => {
  const load = await loadSample();
  for (const [path, text] of renderBundle(load, { knowledge: 'player' })) {
    for (const marker of ['evaded', 'moved(self)', 'movingEvasion']) assert.ok(!text.includes(marker), `${path} shows ${marker}`);
  }
  const masked = renderBundle(load, { knowledge: 'full' }).get('masked.md') ?? '';
  assert.match(masked, /action:bestia:shoot/);
  assert.match(masked, /evaded/);
});
