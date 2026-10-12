// The budget table approval path end to end (SDK 0.5.0, Ingenium R4): the engine's proposal file
// (planning-proposals/1) is reviewed with guide learn consolidate, approved with guide learn
// approve and written with consolidate --apply as approved-budget-table/1 - the same flow as the
// tactic rewrites (design 8.2). Nothing is written without an approval, newer proposals void it,
// and an edited proposal file is refused.

import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { APPROVED_BUDGET_TABLE_PATH, PLANNING_PROPOSALS_PATH, readEngineOutput, type PlanningProposals } from '@ludiars/commentarii-sdk/types';
import { openBundleDir } from '../../src/adapters/fs/open-bundle-dir.ts';
import { openReplayFile } from '../../src/adapters/fs/replay-open-file.ts';
import { writeOutputFiles } from '../../src/adapters/fs/write-output-files.ts';
import { fsScanSource } from '../../src/audit/fs-scan-source.ts';
import type { CliIo } from '../../src/cli/cli-io.ts';
import { runCli } from '../../src/cli/run-cli.ts';
import { contentHash } from '../../src/learn/approval/proposal-hash.ts';
import { createFsLearnIo } from '../../src/learn/io/fs-learn-io.ts';
import { runValidation } from '../../src/validate/run-validation.ts';
import { ENGINE_OUTPUTS_DIR, SAMPLE_DIR, schemaRegistry } from '../support/bundles.ts';
import { testImportIo } from '../support/import-io.ts';

const PROPOSAL_ID = 'budget-table:budget-table/2';

function capture(): { io: CliIo; stdout: () => string; stderr: () => string } {
  let out = '';
  let err = '';
  return {
    io: {
      stdout: (text) => (out += text),
      stderr: (text) => (err += text),
      openBundle: openBundleDir,
      writeFiles: writeOutputFiles,
      openReplay: openReplayFile,
      importIo: testImportIo(),
      scanSource: fsScanSource,
      learnIo: { ...createFsLearnIo(), now: () => new Date('2026-10-12T03:00:00.000Z') },
    },
    stdout: () => out,
    stderr: () => err,
  };
}

async function engineProposals(): Promise<PlanningProposals> {
  return JSON.parse(await readFile(join(ENGINE_OUTPUTS_DIR, PLANNING_PROPOSALS_PATH), 'utf8')) as PlanningProposals;
}

async function withProposals(body: (directory: string, write: (proposals: unknown) => Promise<void>) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'cm-budget-'));
  const write = async (proposals: unknown): Promise<void> => {
    await mkdir(join(directory, 'observations', 'planning'), { recursive: true });
    await writeFile(join(directory, PLANNING_PROPOSALS_PATH), `${JSON.stringify(proposals, null, 2)}\n`, 'utf8');
  };
  try {
    await cp(SAMPLE_DIR, directory, { recursive: true });
    await write(await engineProposals());
    await body(directory, write);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function cli(args: readonly string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const run = capture();
  const code = await runCli(args, run.io);
  return { code, stdout: run.stdout(), stderr: run.stderr() };
}

async function approvedText(directory: string): Promise<string | undefined> {
  return readFile(join(directory, APPROVED_BUDGET_TABLE_PATH), 'utf8').catch(() => undefined);
}

test('review -> approve -> apply writes the approved budget table; nothing before the approval', async () => {
  await withProposals(async (directory) => {
    const review = await cli(['learn', 'consolidate', '--game', directory]);
    assert.equal(review.code, 0, review.stderr);
    assert.match(review.stdout, /## 予算表の変更案 \(人間承認\)/);
    assert.match(review.stdout, new RegExp(`### ${PROPOSAL_ID} \\(承認待ち`));
    assert.match(review.stdout, /realtime\/threat の mcts: 72 → 36/);

    const early = await cli(['learn', 'consolidate', '--game', directory, '--apply']);
    assert.equal(early.code, 0, early.stderr);
    assert.equal(await approvedText(directory), undefined, 'not approved: nothing written');

    const approve = await cli(['learn', 'approve', '--game', directory, '--proposal', PROPOSAL_ID, '--by', 'reviewer', '--reason', 'threat MCTS rarely delivers']);
    assert.equal(approve.code, 0, approve.stderr);
    const apply = await cli(['learn', 'consolidate', '--game', directory, '--apply']);
    assert.equal(apply.code, 0, apply.stderr);
    assert.match(apply.stderr, /applied 1/);

    const text = await approvedText(directory);
    assert.ok(text !== undefined, 'the approved budget table is written');
    const approved = readEngineOutput('approved-budget-table', text, await schemaRegistry());
    const proposals = await engineProposals();
    assert.deepEqual(approved.proposals, proposals, 'the proposals exactly as the engine made them');
    assert.deepEqual(approved.approval, { proposals_hash: proposals.proposals_hash, approved_by: 'reviewer', approved_at: '2026-10-12T03:00:00.000Z' });
    const report = runValidation(await openBundleDir(directory));
    assert.ok(report.ok, JSON.stringify(report.checks.filter((check) => check.status === 'error')));
  });
});

test('newer proposals void the approval; an edited proposal file is refused', async () => {
  await withProposals(async (directory, write) => {
    assert.equal((await cli(['learn', 'approve', '--game', directory, '--proposal', PROPOSAL_ID, '--by', 'reviewer', '--reason', 'ok'])).code, 0);
    const proposals = await engineProposals();
    const changed = proposals.proposals.map((proposal) => ({ ...proposal, to: proposal.to - 6 }));
    await write({ ...proposals, proposals: changed, proposals_hash: contentHash(changed) });
    const stale = await cli(['learn', 'consolidate', '--game', directory, '--apply']);
    assert.equal(stale.code, 0, stale.stderr);
    assert.match(stale.stderr, /1 stale approval/);
    assert.equal(await approvedText(directory), undefined, 'a stale approval writes nothing');

    await write({ ...proposals, proposals: changed });
    const edited = await cli(['learn', 'consolidate', '--game', directory]);
    assert.equal(edited.code, 1);
    assert.match(edited.stderr, /edited after the engine made them/);
  });
});
