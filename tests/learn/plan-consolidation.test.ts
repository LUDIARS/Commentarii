import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LoadResult } from '../../src/bundle/bundle.ts';
import { intentTouch } from '../../src/learn/consolidate/intent-touch.ts';
import { planConsolidation, type Consolidation } from '../../src/learn/consolidate/plan-consolidation.ts';
import { ingestRuns } from '../../src/learn/ingest/ingest-runs.ts';
import type { LearningPolicy } from '../../src/learn/policy/learning-policy.ts';
import { schemaRegistry } from '../support/bundles.ts';
import { BEETLE_ID, CLOSE, driftedPolicy, KITE, loadDrifted, readRuns } from '../support/learn.ts';

async function consolidate(runs: readonly string[], apply: boolean, edit: (policy: LearningPolicy) => LearningPolicy = (policy) => policy): Promise<{ load: LoadResult; result: Consolidation }> {
  const load = await loadDrifted();
  const policy = edit(driftedPolicy(load));
  const { overlay } = ingestRuns({ bundle: load.bundle, gameId: 'bestia', policy, overlay: undefined, runs: await readRuns(...runs) });
  return { load, result: planConsolidation({ bundle: load.bundle, overlay, policy, apply, registry: await schemaRegistry() }) };
}

function statusOf(result: Consolidation, id: string): string | undefined {
  return result.proposals.find((proposal) => proposal.id === id)?.status;
}

test('without --apply every proposal is listed and nothing is written', async () => {
  const { result } = await consolidate(['drift-a'], false);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.proposals.map((proposal) => proposal.id).sort(), [`entity-draft:enemy:bestia:ghost-moth`, `rewrite:${CLOSE}`, `rewrite:${KITE}`]);
});

test('--apply writes an efficient rewrite with superseded_by; a tactic the intent teaches waits', async () => {
  const { result } = await consolidate(['drift-a'], true);
  assert.equal(statusOf(result, `rewrite:${CLOSE}`), 'auto');
  assert.equal(statusOf(result, `rewrite:${KITE}`), 'pending');
  assert.match(result.proposals.find((proposal) => proposal.id === `rewrite:${KITE}`)?.reason ?? '', /intent:bestia:dome-arena:learn-kite \(teach\)/);
  assert.deepEqual(result.applied, [`rewrite:${CLOSE}`]);
  const byPath = new Map(result.changes.map((change) => [change.path, change]));
  assert.deepEqual([...byPath.keys()].sort(), ['tactics/close-in-dragonfly--substitute.json', 'tactics/close-in-dragonfly.json']);
  const created = byPath.get('tactics/close-in-dragonfly--substitute.json');
  assert.equal(created?.before, undefined);
  assert.deepEqual((created?.after as { do: unknown }).do, [{ attack: '$enemy' }, { attack: '$enemy' }]);
  const kept = byPath.get('tactics/close-in-dragonfly.json')?.after as { superseded_by: unknown; do: unknown };
  assert.equal(kept.superseded_by, `${CLOSE}--substitute`, 'the old tactic is kept and points at the new one');
  assert.deepEqual(kept.do, [{ move_to: '$enemy' }, { attack: '$enemy' }]);
  assert.ok(!result.changes.some((change) => change.path.includes('kite-wire-spider')));
});

test('below the thresholds, or with auto_apply false, nothing is rewritten', async () => {
  const strict = await consolidate(['drift-a'], true, (policy) => ({ ...policy, rewrite: { ...policy.rewrite, min_gain: 0.6 } }));
  assert.ok(!strict.result.proposals.some((proposal) => proposal.kind === 'rewrite'));
  assert.deepEqual(strict.result.changes, []);
  const manual = await consolidate(['drift-a'], true, (policy) => ({ ...policy, rewrite: { ...policy.rewrite, auto_apply: false } }));
  assert.equal(statusOf(manual.result, `rewrite:${CLOSE}`), 'pending');
  assert.deepEqual(manual.result.changes, []);
});

test('omniscient runs never count toward a promotion; enough player runs make a pending candidate', async () => {
  const promotion = `promotion:${BEETLE_ID}.stats.health`;
  const mixed = await consolidate(['drift-a', 'drift-b', 'omni-a', 'omni-b'], true);
  assert.equal(statusOf(mixed.result, promotion), undefined, '2 player runs (+2 omniscient) are below player_runs 3');
  const enough = await consolidate(['drift-a', 'drift-b', 'drift-c', 'omni-a'], true);
  const proposal = enough.result.proposals.find((item) => item.id === promotion);
  assert.equal(proposal?.status, 'pending');
  assert.deepEqual(proposal?.promotion, { ref: `${BEETLE_ID}.stats.health`, value: 180, player_runs: 3, agreement: 1, requires: { player_runs: 3, agreement: 0.9 } });
  assert.deepEqual(proposal?.evidence, ['run:drift-a', 'run:drift-b', 'run:drift-c']);
  assert.deepEqual(proposal?.files.map((file) => file.path), ['entities/enemies/bazooka-beetle.masked.json', 'entities/enemies/bazooka-beetle.json']);
  assert.ok(!enough.result.changes.some((change) => change.path.startsWith('entities/')), 'promotions are never applied automatically');
});

test('a rewrite passing a forbid area touches the intent', async () => {
  const load = await loadDrifted();
  const intents = load.bundle.intents.map(({ doc }) => doc);
  const close = load.bundle.tactics.find(({ doc }) => doc.id === CLOSE)?.doc;
  assert.ok(close);
  assert.equal(intentTouch(intents, [close], ['node:mid-ring']), undefined);
  assert.match(intentTouch(intents, [close], ['node:outside']) ?? '', /forbid area node:outside/);
  assert.match(intentTouch(intents, [{ ...close, do: [{ move_to: 'node:outside' }] }], []) ?? '', /forbid area node:outside/);
});
