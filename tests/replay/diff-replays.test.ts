import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffReplays } from '../../src/replay/diff-replays.ts';
import { formatReplayDiffMarkdown } from '../../src/replay/format-replay-diff-markdown.ts';
import type { ReplayRun } from '../../src/replay/replay-record.ts';
import { BASE_RUN, BRANCH_RUN, loadRun } from './replay-fixtures.ts';

test('a run compared with itself has no divergence', async () => {
  const base = await loadRun(BASE_RUN);
  const diff = diffReplays(base, base);
  assert.equal(diff.first_divergence, null);
  assert.deepEqual(diff.action_diff, { count: 0, limit: 10, shown: [] });
  assert.match(formatReplayDiffMarkdown(diff), /判断の分岐はありません/);
});

test('the branch fixture diverges first at tick 5 with the utility differences of that tick', async () => {
  const diff = diffReplays(await loadRun(BASE_RUN), await loadRun(BRANCH_RUN));
  const divergence = diff.first_divergence;
  assert.ok(divergence);
  assert.equal(divergence.tick, 5);
  assert.deepEqual(divergence.reasons, ['action', 'decision']);
  assert.deepEqual(divergence.a_action, { attack: 2 });
  assert.deepEqual(divergence.b_action, { move_to: 'node:outer-ring' });
  assert.equal(divergence.a_chosen, 'generic:attack-nearest');
  assert.equal(divergence.b_chosen, 'tactic:bestia:kite-wire-spider');

  const byCandidate = new Map(divergence.utilities.map((row) => [row.candidate, row]));
  assert.equal(byCandidate.size, 4);
  const kite = byCandidate.get('tactic:bestia:kite-wire-spider');
  assert.equal(kite?.a, 0.55);
  assert.equal(kite?.b, 0.64);
  assert.ok(Math.abs((kite?.delta ?? 0) - 0.09) < 1e-9);
  assert.equal(kite?.chosen_b, true);
  assert.ok(Math.abs((byCandidate.get('generic:attack-nearest')?.delta ?? 0) + 0.04) < 1e-9);
  assert.equal(byCandidate.get('generic:survive')?.delta, 0);
});

test('action differences from the branch on are counted in full and listed up to the limit', async () => {
  const base = await loadRun(BASE_RUN);
  const branch = await loadRun(BRANCH_RUN);
  const diff = diffReplays(base, branch);
  assert.equal(diff.action_diff.count, 3);
  assert.deepEqual(diff.action_diff.shown.map((row) => row.tick), [5, 6, 7]);
  assert.deepEqual(diff.action_diff.shown[1], { tick: 6, a: { attack: 2 }, b: { wait: 1 } });

  const limited = diffReplays(base, branch, { limit: 1 });
  assert.equal(limited.action_diff.count, 3);
  assert.equal(limited.action_diff.shown.length, 1);

  const markdown = formatReplayDiffMarkdown(diff);
  assert.match(markdown, /- ティック: 5/);
  assert.match(markdown, /\| tactic:bestia:kite-wire-spider \| 0\.55 \| 0\.64 \| 0\.09 \|  \| ✓ \|/);
  assert.match(markdown, /件数: 3 \(先頭 3 件を表示\)/);
});

test('a tick present in only one run is a divergence', async () => {
  const base = await loadRun(BASE_RUN);
  const shorter: ReplayRun = { ...base, ticks: base.ticks.slice(0, 8) };
  const diff = diffReplays(base, shorter);
  assert.equal(diff.first_divergence?.tick, 8);
  assert.deepEqual(diff.first_divergence?.reasons, ['missing-tick']);
  assert.equal(diff.first_divergence?.b_action, null);
  assert.equal(diff.action_diff.count, 2);
});

test('the same action under a different chosen candidate is a decision divergence', async () => {
  const base = await loadRun(BASE_RUN);
  const relabelled: ReplayRun = {
    ...base,
    ticks: base.ticks.map((tick) =>
      tick.tick === 2 ? { ...tick, decision: tick.decision.map((entry) => ({ ...entry, chosen: entry.candidate === 'generic:survive' })) } : tick,
    ),
  };
  const diff = diffReplays(base, relabelled);
  assert.equal(diff.first_divergence?.tick, 2);
  assert.deepEqual(diff.first_divergence?.reasons, ['decision']);
  assert.equal(diff.action_diff.count, 0);
});
