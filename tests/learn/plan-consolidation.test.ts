import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Bundle, LoadResult } from '../../src/bundle/bundle.ts';
import type { Approval } from '../../src/learn/approval/approvals.ts';
import type { Intent } from '../../src/domain/documents.ts';
import type { HumanCandidates } from '../../src/import/plays/human-candidates.ts';
import type { Proposal } from '../../src/learn/consolidate/proposal.ts';
import { intentTouch } from '../../src/learn/consolidate/intent-touch.ts';
import { planConsolidation, type Consolidation } from '../../src/learn/consolidate/plan-consolidation.ts';
import { ingestRuns } from '../../src/learn/ingest/ingest-runs.ts';
import type { LearningPolicy } from '../../src/learn/policy/learning-policy.ts';
import { schemaRegistry } from '../support/bundles.ts';
import { BEETLE_ID, CLOSE, driftedPolicy, KITE, loadDrifted, readRuns } from '../support/learn.ts';

interface ConsolidateOptions {
  readonly approvals?: readonly Approval[];
  /** Edits the loaded bundle before consolidating (e.g. an intent without time / design_stance). */
  readonly bundle?: (bundle: Bundle) => Bundle;
}

async function consolidate(runs: readonly string[], apply: boolean, edit: (policy: LearningPolicy) => LearningPolicy = (policy) => policy, options: ConsolidateOptions = {}): Promise<{ load: LoadResult; result: Consolidation }> {
  const load = await loadDrifted();
  const bundle = options.bundle?.(load.bundle) ?? load.bundle;
  const policy = edit(driftedPolicy(load));
  const { overlay } = ingestRuns({ bundle, gameId: 'bestia', policy, overlay: undefined, runs: await readRuns(...runs) });
  return { load, result: planConsolidation({ bundle, overlay, policy, apply, registry: await schemaRegistry(), approvals: options.approvals ?? [] }) };
}

/** The sample intent keeps teach / forbid / route only: no time range, no design_stance. */
function efficiencyOnlyIntent(bundle: Bundle): Bundle {
  return {
    ...bundle,
    intents: bundle.intents.map((located) => {
      const { design_stance: _stance, ...doc } = located.doc;
      return { ...located, doc: { ...doc, intended: doc.intended.filter((item) => item.kind !== 'time') } };
    }),
  };
}

function approvalOf(proposal: Proposal | undefined, overrides: Partial<Approval> = {}): Approval {
  assert.ok(proposal);
  return { proposal: proposal.id, content_hash: proposal.content_hash, manifest_version: proposal.basis.manifest_version, approved_by: 'neco', rationale: 'measured faster, same condition', approved_at: '2026-10-09T00:00:00.000Z', ...overrides };
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

test('on a stage with a time range and an open design_stance the efficient rewrite waits for a person', async () => {
  const { result } = await consolidate(['drift-a'], true);
  const close = result.proposals.find((proposal) => proposal.id === `rewrite:${CLOSE}`);
  assert.equal(close?.status, 'pending');
  assert.match(close?.reason ?? '', /time range of intent intent:bestia:dome-arena:time|design_stance is open/);
  assert.deepEqual(result.changes, []);
});

test('--apply writes an efficient rewrite with superseded_by; a tactic the intent teaches waits', async () => {
  const { result } = await consolidate(['drift-a'], true, undefined, { bundle: efficiencyOnlyIntent });
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
  const manual = await consolidate(['drift-a'], true, (policy) => ({ ...policy, rewrite: { ...policy.rewrite, auto_apply: false } }), { bundle: efficiencyOnlyIntent });
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

test('an approval bound to the content hash and guide version lets --apply write a pending proposal', async () => {
  const first = await consolidate(['drift-a'], false);
  const close = first.result.proposals.find((proposal) => proposal.id === `rewrite:${CLOSE}`);
  assert.equal(close?.status, 'pending');
  const approved = await consolidate(['drift-a'], true, undefined, { approvals: [approvalOf(close)] });
  assert.deepEqual(approved.result.approved, [`rewrite:${CLOSE}`]);
  assert.deepEqual(approved.result.applied, [`rewrite:${CLOSE}`]);
  assert.deepEqual(approved.result.changes.map((change) => change.path).sort(), ['tactics/close-in-dragonfly--substitute.json', 'tactics/close-in-dragonfly.json']);
  assert.ok(!approved.result.applied.includes(`rewrite:${KITE}`), 'an unapproved pending proposal is never written');
});

test('an approval goes stale when the proposal content or the guide version changes, and is not applied', async () => {
  const first = await consolidate(['drift-a'], false);
  const close = first.result.proposals.find((proposal) => proposal.id === `rewrite:${CLOSE}`);
  // An approval of an earlier content of the proposal (another patch / evidence / basis).
  const earlier = await consolidate(['drift-a'], true, undefined, { approvals: [approvalOf(close, { content_hash: `sha256:${'0'.repeat(64)}` })] });
  assert.deepEqual(earlier.result.stale.map((entry) => entry.proposal), [`rewrite:${CLOSE}`]);
  assert.match(earlier.result.stale[0]?.why ?? '', /content hash differs/);
  assert.deepEqual(earlier.result.applied, []);
  assert.deepEqual(earlier.result.approved, []);
  const otherVersion = await consolidate(['drift-a'], true, undefined, { approvals: [approvalOf(close, { manifest_version: '0.0.9' })] });
  assert.match(otherVersion.result.stale[0]?.why ?? '', /guide version 0\.0\.9/);
  assert.deepEqual(otherVersion.result.changes, []);
});

test('the content hash covers patches, evidence and basis, not the tool verdict', async () => {
  const pending = await consolidate(['drift-a'], false);
  const auto = await consolidate(['drift-a'], false, undefined, { bundle: efficiencyOnlyIntent });
  const [a, b] = [pending, auto].map(({ result }) => result.proposals.find((proposal) => proposal.id === `rewrite:${CLOSE}`));
  assert.notEqual(a?.status, b?.status);
  assert.equal(a?.content_hash, b?.content_hash);
  assert.match(a?.content_hash ?? '', /^sha256:[0-9a-f]{64}$/);
  assert.equal(a?.basis.manifest_version, '0.1.0');
  assert.ok(a?.basis.condition !== undefined, 'a rewrite records the condition both sides were measured under');
});

test('a relax variant changes the condition and always waits, even under auto_apply', async () => {
  const load = await loadDrifted();
  const bundle = efficiencyOnlyIntent(load.bundle);
  const policy = driftedPolicy(load);
  const { overlay } = ingestRuns({ bundle, gameId: 'bestia', policy, overlay: undefined, runs: await readRuns('drift-a') });
  const relaxed = { ...overlay, rewrites: overlay.rewrites.map((rewrite) => ({ ...rewrite, mutation: 'relax' as const })) };
  const result = planConsolidation({ bundle, overlay: relaxed, policy, apply: true, registry: await schemaRegistry() });
  const close = result.proposals.find((proposal) => proposal.id === `rewrite:${CLOSE}`);
  assert.equal(close?.status, 'pending');
  assert.match(close?.reason ?? '', /relax changes the when condition/);
  assert.deepEqual(result.changes, []);
});

test('every intent kind is judged: route, time, design_stance, illusory_by_design, allowed_divergences; other stages do not count', async () => {
  const load = await loadDrifted();
  const close = load.bundle.tactics.find(({ doc }) => doc.id === CLOSE)?.doc;
  assert.ok(close);
  const variant = { ...close, id: `${CLOSE}--v` };
  const route = { id: 'intent:bestia:dome-arena:r', kind: 'route' as const, path: ['node:mid-ring', 'node:center'] };
  const intent = (extra: Partial<Intent>): Intent[] => [{ stage: 'stage:bestia:dome-arena', intended: [route], allowed_divergences: [], ...extra }];
  assert.equal(intentTouch(intent({}), [close, variant], []), undefined);
  assert.match(intentTouch(intent({}), [close, { ...variant, do: [{ move_to: 'node:center' }] }], []) ?? '', /route of intent intent:bestia:dome-arena:r/);
  const timed: Intent[] = [{ stage: 'stage:bestia:dome-arena', intended: [{ id: 'intent:bestia:dome-arena:t', kind: 'time', range_sec: [60, 180] }], allowed_divergences: [] }];
  assert.equal(intentTouch(timed, [close, variant], [], { timeChanged: false }), undefined);
  assert.match(intentTouch(timed, [close, variant], [], { timeChanged: true }) ?? '', /time range of intent/);
  assert.match(intentTouch(intent({ design_stance: 'open' }), [close, variant], [], { supersedes: true }) ?? '', /design_stance is open/);
  assert.equal(intentTouch(intent({ design_stance: 'refined' }), [close, variant], [], { supersedes: true }), undefined);
  assert.match(intentTouch(intent({ illusory_by_design: [{ tactics: [CLOSE], rationale: 'bait', decided_by: 'neco' }] }), [close, variant], []) ?? '', /illusory_by_design/);
  assert.match(intentTouch(intent({ allowed_divergences: [{ run: 'run:x', summary: 's', decided_by: 'neco', tactic: CLOSE }] }), [close, variant], []) ?? '', /accepted divergence/);
  const elsewhere = { ...close, when: { all: [{ stage: { id: 'stage:bestia:other-arena' } }] } };
  assert.equal(intentTouch(timed, [elsewhere, { ...elsewhere, id: `${CLOSE}--v` }], [], { timeChanged: true }), undefined);
});

test('human alternatives become pending tactic proposals that land as non-draft learned tactics once approved', async () => {
  const load = await loadDrifted();
  const policy = driftedPolicy(load);
  const { overlay } = ingestRuns({ bundle: load.bundle, gameId: 'bestia', policy, overlay: undefined, runs: await readRuns('drift-a') });
  const known = load.bundle.tactics[0]?.doc;
  assert.ok(known);
  const { metrics: _metrics, ...base } = known;
  const tactic = { ...base, id: 'tactic:bestia:human-dash-past', confidence: 'learned' as const, draft: true, superseded_by: null };
  const evidence = (runIds: string[], successRate: number) => ({ stage: 'stage:bestia:dome-arena', occurrences: runIds.length + 1, runs: runIds.length, players: runIds.length, run_ids: runIds, success_rate: successRate });
  const humanCandidates: HumanCandidates = {
    game_id: 'bestia',
    runs: 2,
    candidates: [
      { tactic, source: { kind: 'human', ref: 'run:human-a run:human-b x3' }, evidence: evidence(['run:human-a', 'run:human-b'], 1) },
      { tactic: { ...known, draft: true }, source: { kind: 'human', ref: 'run:human-a x1' }, evidence: evidence(['run:human-a'], 0) },
    ],
  };
  const registry = await schemaRegistry();
  const pending = planConsolidation({ bundle: load.bundle, overlay, policy, apply: true, registry, humanCandidates });
  const human = pending.proposals.filter((proposal) => proposal.kind === 'human-tactic');
  assert.deepEqual(human.map((proposal) => [proposal.id, proposal.status]), [['human-tactic:tactic:bestia:human-dash-past', 'pending']], 'a candidate whose tactic exists is skipped');
  assert.ok(!pending.applied.includes('human-tactic:tactic:bestia:human-dash-past'));
  const approved = planConsolidation({ bundle: load.bundle, overlay, policy, apply: true, registry, humanCandidates, approvals: [approvalOf(human[0])] });
  const written = approved.changes.find((change) => change.path === 'tactics/human-dash-past.json')?.after as { draft: boolean; confidence: string } | undefined;
  assert.deepEqual([written?.draft, written?.confidence], [false, 'learned']);
});
