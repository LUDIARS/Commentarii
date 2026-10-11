// Static check of rulebook expressions with the Bestia rulebook's scope: unknown functions,
// variables, parameters and IDs, owner kinds and argument counts, without evaluating.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBundleIndex, unresolvedReason } from '@ludiars/commentarii-sdk/bundle';
import { checkExpression } from '@ludiars/commentarii-sdk/expression';
import { rulebookScope } from '@ludiars/commentarii-sdk/rulebook';
import { loadSample } from '../../support/bundles.ts';

async function scope(params: readonly string[] = [], site: 'declaration' | 'element' = 'element') {
  const load = await loadSample();
  const index = buildBundleIndex(load.bundle);
  const variables = load.bundle.rulebook.variables?.doc;
  assert.ok(variables);
  return rulebookScope({ variables, resolveId: (id) => unresolvedReason(index, id) }, { params, site });
}

function kinds(source: string, s: Awaited<ReturnType<typeof scope>>): string[] {
  return checkExpression(source, s).map((problem) => problem.kind);
}

test('a well-formed rulebook expression has no problem', async () => {
  const s = await scope(['target']);
  assert.deepEqual(kinds('t >= ready_at(actor) && dist(actor, $target) <= range(actor)', s), []);
  assert.deepEqual(kinds('hp($target) - rule(rule:bestia:damage)', s), []);
  assert.deepEqual(kinds('mode($target) != state:bestia:battle-ai#dodge', s), []);
  assert.deepEqual(kinds('count(hostile) == 0 && sum(hostile, hp) > 0', s), []);
});

test('each kind of unknown reference is reported', async () => {
  const s = await scope(['target']);
  assert.deepEqual(kinds('stamina(self) > 0', s), ['unknown-function']);
  assert.deepEqual(kinds('hp > 0', s), ['unknown-variable']);
  assert.deepEqual(kinds('hp($goal) > 0', s), ['unknown-parameter']);
  assert.deepEqual(kinds('rule(rule:bestia:missing) > 0', s), ['unknown-id']);
  assert.deepEqual(kinds('state:bestia:battle-ai#fly == 1', s), ['unknown-id']);
  assert.deepEqual(kinds('dist(self) > 0', s), ['arity']);
});

test('an owner-typed variable read off a map node is the wrong argument', async () => {
  const s = await scope();
  assert.deepEqual(kinds('hp(node:center) > 0', s), ['argument']);
  assert.deepEqual(kinds('count(hp) > 0', s), ['argument']);
  assert.deepEqual(kinds('rule(state:bestia:battle-ai) > 0', s), ['argument']);
});

test('inside a variable declaration bare names are the same owner\'s variables', async () => {
  assert.deepEqual(kinds('hp > 0', await scope([], 'declaration')), []);
});

test('a syntax error is one problem and nothing else', async () => {
  const problems = checkExpression('hp(self) >', await scope());
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.kind, 'syntax');
});
