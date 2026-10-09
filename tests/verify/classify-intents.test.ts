import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Intent } from '../../src/domain/documents.ts';
import { classifyIntents } from '../../src/verify/intent/classify-intents.ts';
import { mergeDivergences } from '../../src/verify/intent/divergence-store.ts';
import { selectRuns } from '../../src/verify/runs/select-runs.ts';
import { loadSample } from '../support/bundles.ts';
import { FORBID_INTENT, fixtureTraces, MAIN_RUNS, readFixtureRuns, ROUTE_INTENT, SEALED_RUNS, TEACH_INTENT, TIME_INTENT, trace } from '../support/verify.ts';

async function sampleIntent(): Promise<Intent> {
  const intent = (await loadSample()).bundle.intents[0]?.doc;
  assert.ok(intent);
  return intent;
}

function classes(verification: ReturnType<typeof classifyIntents>): Record<string, string> {
  return Object.fromEntries(verification.verdicts.map((verdict) => [verdict.intent, verdict.classification]));
}

test('the fixtures produce every class: match, interesting, undesirable and impossible', async () => {
  const intent = await sampleIntent();
  const main = await fixtureTraces(MAIN_RUNS);
  assert.deepEqual(classes(classifyIntents({ intent, ...main })), {
    [ROUTE_INTENT]: 'interesting',
    [TEACH_INTENT]: 'undesirable',
    [TIME_INTENT]: 'match',
    [FORBID_INTENT]: 'undesirable',
  });
  const sealed = await fixtureTraces(SEALED_RUNS);
  const sealedClasses = classes(classifyIntents({ intent, ...sealed }));
  assert.equal(sealedClasses[ROUTE_INTENT], 'impossible', 'no run reaches the center: the intended route cannot be reproduced');
  assert.equal(sealedClasses[TEACH_INTENT], 'impossible', 'no run uses the taught tactic');
});

test('divergences carry reason, signature and runs', async () => {
  const verification = classifyIntents({ intent: await sampleIntent(), ...(await fixtureTraces(MAIN_RUNS)) });
  const byReason = new Map(verification.divergences.map((divergence) => [divergence.reason, divergence]));
  assert.deepEqual([...byReason.keys()].sort(), ['alt-route', 'forbid-entered', 'teach-skipped']);
  assert.deepEqual(byReason.get('alt-route')?.runs, ['run:verify-alt-expert']);
  assert.equal(byReason.get('alt-route')?.kind, 'interesting');
  assert.deepEqual(byReason.get('forbid-entered')?.signature.route, ['node:mid-ring', 'node:outer-ring', 'node:outside', 'node:outer-ring', 'node:center']);
  assert.deepEqual(byReason.get('teach-skipped')?.runs, ['run:verify-noteach-novice'], 'the human run has no decision log and is not judged on teach');
  for (const divergence of verification.divergences) assert.match(divergence.id, /^div-[0-9a-f]{12}$/);
});

test('omniscient and efficiency runs are never classified', async () => {
  const selection = selectRuns(await readFixtureRuns(MAIN_RUNS));
  assert.deepEqual(selection.ignoredOmniscient, ['run:verify-omni-expert']);
  assert.deepEqual(selection.ignoredEfficiency, ['run:verify-efficiency-expert']);
  const counted = selection.counted.map((entry) => entry.run.header.run_id);
  assert.ok(!counted.includes('run:verify-omni-expert'));
  const verification = classifyIntents({ intent: await sampleIntent(), ...(await fixtureTraces(MAIN_RUNS)) });
  for (const divergence of verification.divergences) assert.ok(!divergence.runs.includes('run:verify-omni-expert'));
  const forbid = verification.verdicts.find((verdict) => verdict.intent === FORBID_INTENT);
  assert.equal(forbid?.runs, 7, 'the omniscient run that entered node:outside is not one of the judged runs');
});

test('--persona keeps only that persona engine runs', async () => {
  const selection = selectRuns(await readFixtureRuns(MAIN_RUNS), 'expert');
  assert.deepEqual(selection.counted.map((entry) => entry.run.header.run_id), ['run:verify-alt-expert', 'run:verify-match-expert']);
  assert.ok(selection.filteredOut.includes('run:verify-human-a'));
});

test('an accepted divergence is not reported again (by divergence ID, run or signature)', async () => {
  const intent = await sampleIntent();
  const main = await fixtureTraces(MAIN_RUNS);
  const first = classifyIntents({ intent, ...main });
  const alt = first.divergences.find((divergence) => divergence.reason === 'alt-route');
  assert.ok(alt);
  const allowedBy = [
    { run: 'run:x', summary: 's', decided_by: 'neco', divergence: alt.id },
    { run: 'run:verify-alt-expert', summary: 's', decided_by: 'neco' },
    { run: 'run:x', summary: 's', decided_by: 'neco', intent: ROUTE_INTENT, signature: alt.signature },
  ];
  for (const allowed of allowedBy) {
    const again = classifyIntents({ intent: { ...intent, allowed_divergences: [allowed] }, ...main });
    assert.ok(!again.divergences.some((divergence) => divergence.id === alt.id), JSON.stringify(allowed));
    assert.deepEqual(again.accepted.map((entry) => entry.divergence.id), [alt.id]);
    assert.equal(classes(again)[ROUTE_INTENT], 'match');
  }
});

test('time below the range is a shortcut (interesting), above it over-time (undesirable)', async () => {
  const intent = await sampleIntent();
  const fast = classifyIntents({ intent, traces: [trace({ run: 'run:fast', timeSec: 30 })], ignoredOmniscient: [] });
  assert.equal(classes(fast)[TIME_INTENT], 'interesting');
  assert.equal(fast.divergences.find((divergence) => divergence.intent === TIME_INTENT)?.reason, 'shortcut');
  const slow = classifyIntents({ intent, traces: [trace({ run: 'run:slow', timeSec: 300 })], ignoredOmniscient: [] });
  assert.equal(classes(slow)[TIME_INTENT], 'undesirable');
  const none = classifyIntents({ intent, traces: [], ignoredOmniscient: [] });
  assert.equal(classes(none)[ROUTE_INTENT], 'unverified', 'no run: no ground for impossible');
});

test('merging keeps human verdicts and never drops an entry', async () => {
  const verification = classifyIntents({ intent: await sampleIntent(), ...(await fixtureTraces(MAIN_RUNS)) });
  const store = mergeDivergences(undefined, 'bestia', verification.divergences);
  assert.ok(store.divergences.every((entry) => entry.decision === 'pending'));
  const [first, ...rest] = store.divergences;
  assert.ok(first);
  const judged = { ...store, divergences: [{ ...first, decision: 'reject' as const, decided_by: 'neco', note: 'no' }, ...rest] };
  const again = mergeDivergences(judged, 'bestia', []);
  assert.equal(again.divergences.length, store.divergences.length);
  const kept = again.divergences.find((entry) => entry.id === first.id);
  assert.equal(kept?.decision, 'reject');
  assert.equal(kept?.note, 'no');
  assert.equal(again.divergences.at(-1)?.id, first.id, 'rejected entries go last');
});
