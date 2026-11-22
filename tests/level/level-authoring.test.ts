
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { toPlayerView } from '../../packages/sdk/src/bundle/player-view.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { createMainIo } from '../../src/cli/main-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import { checkLevelSkeleton } from '../../src/level/check-level-skeleton.ts';
import { compareLevelIntent } from '../../src/level/compare-level-intent.ts';
import { levelBundleHash } from '../../src/level/level-bundle.ts';
import { readLevelPrinciples } from '../../src/level/level-principles.ts';
import { parseLevelQuality, type LevelFinding } from '../../src/level/level-reports.ts';
import { levelRuleId } from '../../src/level/level-rule-id.ts';
import { isLevelIntent } from '../../src/level/validate-level-intent.ts';
import { BASE, CHALLENGE, EXISTING_RULE, HASH, INTENT, quality, STAGE } from './level-fixture.ts';

test('the SDK validates level intent and omits evaluator fields from the player view', async () => {
  const io = createMainIo({ stdout: () => {}, stderr: () => {} });
  assert.ok(io.learnIo);
  const registry = await io.learnIo.schemaRegistry();
  assert.equal(isLevelIntent(INTENT, registry), true);
  const item = INTENT.intended[0];
  assert.ok(item?.kind === 'route');
  const invalid = { ...INTENT, intended: [{ ...item, level: { ...item.level, decisions: [{ id: '1', options: '2', regime: 'calm' }] } }] };
  assert.equal(isLevelIntent(invalid, registry), false);
  const root = await mkdtemp(join(tmpdir(), 'guide-level-schema-'));
  try {
    await writeOutputFiles(root, new Map(Object.entries(BASE).map(([path, value]) => [path, JSON.stringify(value)])));
    const { bundle, issues } = await io.openBundle(root);
    assert.deepEqual(issues, []);
    assert.equal(toPlayerView(bundle).intents[0]?.doc.intended.some((entry) => 'level' in entry), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the skeleton check uses the SDK principles and detects upstream drift', async () => {
  const principles = await readLevelPrinciples();
  assert.deepEqual(checkLevelSkeleton([INTENT], principles).map(({ principle }) => principle), ['P2', 'P4', 'P9']);
  const root = await mkdtemp(join(tmpdir(), 'guide-level-principles-'));
  try {
    const path = join(root, '1.json');
    await writeFile(path, '{"schema":"level-principles/1"}', 'utf8');
    await assert.rejects(readLevelPrinciples(path), /differs from the supplied upstream/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the probe wire format yields six distinct divergence reasons and leaves incomplete cases open', async () => {
  const base = quality();
  const challenge = base.challenges[0];
  assert.ok(challenge);
  // The probe exposes hashed rule keys and one confirmation cell per tier.
  const confirmation = ['unviable', 'viable', 'viable', 'viable', 'viable'].map((status) => ({ status }));
  const report = parseLevelQuality({ ...base, challenges: [{
    ...challenge,
    classes: [
      { id: '1', rules: [levelRuleId(EXISTING_RULE)], confirmation },
      { id: '2', rules: [`rule:${HASH}`], confirmation },
    ],
  }] });
  assert.match(levelRuleId(EXISTING_RULE), /^rule:sha256:[a-f0-9]{64}$/);
  const divergences = compareLevelIntent([INTENT], report);
  assert.deepEqual(divergences.map(({ reason }) => reason).sort(), [
    'blocked-solution', 'choice-count-mismatch', 'disclosure-mismatch', 'feel-mismatch', 'skill-mismatch', 'unexpected-solution',
  ]);
  assert.equal(new Set(divergences.map(({ id }) => id)).size, 6);
  const measured = report.challenges[0];
  assert.ok(measured);
  assert.deepEqual(compareLevelIntent([INTENT], { ...report, challenges: [{
    ...measured, omitted_classes: 1, undetermined: true, not_measured: ['spontaneous'],
  }] }).map(({ reason }) => reason), ['unexpected-solution']);
});

test('guide records probe observations and approves and reviews an isolated proposal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'guide-level-cli-'));
  const game = join(root, '1');
  const out = join(root, '2');
  let stdout = '';
  let stderr = '';
  const io = {
    ...createMainIo({ stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; } }),
    delegationIo: {
      findIngenium: () => { throw new Error('level commands must use report files'); },
      runIngenium: async () => { throw new Error('level commands must use report files'); },
    },
  };
  async function call(args: string[], expected = 0) {
    stdout = '';
    stderr = '';
    assert.equal(await runCli(args, io), expected, stderr);
    return JSON.parse(stdout) as Record<string, unknown>;
  }
  async function input(name: string, value: unknown) {
    const path = join(root, name);
    await writeFile(path, JSON.stringify(value), 'utf8');
    return path;
  }
  try {
    await writeOutputFiles(game, new Map(Object.entries(BASE).map(([path, value]) => [path, JSON.stringify(value)])));
    const before = await readFile(join(game, 'intent/1.json'), 'utf8');
    const base = quality(levelBundleHash(await io.openBundle(game)));
    const { challenges: [challenge] } = base;
    assert.ok(challenge);
    const { moves } = await readLevelPrinciples();
    const move = moves['no-choice'];
    assert.ok(move);
    const finding: LevelFinding = { id: 'no-choice', severity: 'bad', evidence: 'sim', references: [], move };
    const probe = await input('base.json', { ...base, challenges: [{ ...challenge, findings: [finding] }] });
    const check = await call(['level', 'check', '--game', game], 1);
    assert.ok(Array.isArray(check.issues) && check.issues.length === 3);
    await call(['level', 'verify', '--game', game, '--probe', probe]);
    const storePath = join(game, 'observations/divergences.json');
    const store = JSON.parse(await readFile(storePath, 'utf8')) as { divergences: { reason: string; id: string }[] };
    assert.ok(store.divergences.some(({ reason }) => reason === 'choice-count-mismatch'));
    const { intended: [route] } = INTENT;
    assert.ok(route?.kind === 'route');
    const revision = { ...INTENT, intended: [{ ...route, level: { ...route.level, decisions: [{ id: '1', options: 2, regime: 'critical' }] } }] };
    const edit = await input('edit.json', [{ path: 'intent/1.json', document: revision }]);
    const proposal = await call(['level', 'propose', '--game', game, '--probe', probe, '--stage', STAGE, '--challenge', CHALLENGE,
      '--finding', 'no-choice', '--edit', edit]);
    const id = proposal.id;
    assert.equal(proposal.status, 'pending');
    assert.equal(proposal.reason, move);
    assert.ok(typeof id === 'string');
    const prepare = ['level', 'prepare', '--game', game, '--proposal', id, '--out', out];
    assert.equal(await runCli(prepare, io), 1);
    assert.match(stderr, /requires a current guide learn approve/);
    await call(['learn', 'approve', '--game', game, '--proposal', id, '--by', '1', '--reason', '1']);
    const copy = await call(prepare);
    assert.deepEqual(JSON.parse(await readFile(join(out, 'intent/1.json'), 'utf8')), revision);
    assert.equal(await runCli(prepare, io), 1);
    assert.equal(await readFile(join(game, 'intent/1.json'), 'utf8'), before);
    assert.ok(typeof copy.bundle_hash === 'string');
    const candidate = { ...quality(copy.bundle_hash), challenges: [{
      ...challenge, choice: { counts: { fit: 2 }, total: 2 },
    }] };
    const head = await input('head.json', candidate);
    const gate = await input('gate.json', { schema: 'level-gate/1', comparable: true, candidates: [{ id: '1', change: 1, threshold: 1 }] });
    const review = ['level', 'review', '--game', game, '--proposal', id, '--base', probe, '--head', head, '--gate', gate];
    const failed = await call(review, 1);
    assert.equal(failed.accepted, false);
    assert.equal(failed.retained, undefined);
    const reviewPath = join(game, 'observations/level-design/reviews');
    assert.equal((await readdir(reviewPath)).length, 1);

    await writeFile(gate, JSON.stringify({ schema: 'level-gate/1', comparable: true, candidates: [] }));
    await writeFile(head, JSON.stringify({ ...quality(copy.bundle_hash), challenges: [{ ...challenge, findings: [finding] }] }));
    assert.equal((await call(review, 1)).accepted, false);
    await writeFile(head, JSON.stringify({ ...quality(copy.bundle_hash), compatibility: { ...base.compatibility, seed: 2 } }));
    assert.equal((await call(review, 1)).accepted, false);
    await writeFile(head, JSON.stringify(candidate));
    const passed = await call(review);
    assert.equal(passed.accepted, true);
    assert.ok(Array.isArray(passed.retained) && passed.retained.length === 1);
    assert.equal(await readFile(join(game, 'intent/1.json'), 'utf8'), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
