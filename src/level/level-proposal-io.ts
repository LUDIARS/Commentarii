
import { join } from 'node:path';
import type { LoadResult } from '@ludiars/commentarii-sdk/types';
import type { LearnIo } from '../learn/cli/learn-io.ts';
import { applyProposals } from '../learn/consolidate/apply-proposals.ts';
import { approvalState } from '../learn/approval/approvals.ts';
import { readApprovals } from '../learn/approval/read-approvals.ts';
import { levelProposalPath, parseLevelDraft, rebuildLevelProposal } from './build-level-proposal.ts';
import { levelBundleHash, requireLevelBundle, trialBundle } from './level-bundle.ts';
import type { LevelTrial } from './review-level-trial.ts';

export async function readLevelJson(io: Pick<LearnIo, 'readText'>, path: string): Promise<unknown> {
  const text = await io.readText(path);
  if (text === undefined) throw new Error(`file not found: ${path}`);
  try {
    return JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
  } catch {
    throw new Error(`invalid JSON: ${path}`);
  }
}

export async function readLevelProposal(io: LearnIo, game: string, load: LoadResult, id: string) {
  requireLevelBundle(load);
  const draft = parseLevelDraft(await readLevelJson(io, join(game, levelProposalPath(id))));
  const proposal = rebuildLevelProposal(load, draft, id);
  return { proposal, draft };
}

export async function approvedTrial(io: LearnIo, game: string, load: LoadResult, id: string): Promise<{
  readonly trial: LevelTrial;
  readonly files: ReadonlyMap<string, string>;
}> {
  const { proposal, draft } = await readLevelProposal(io, game, load, id);
  const approvals = await readApprovals(io, game, proposal.basis.game_id);
  if (approvalState(proposal, approvals?.approvals ?? []).state !== 'approved') {
    throw new Error('proposal requires a current guide learn approve record');
  }
  const registry = await io.schemaRegistry();
  const copy = trialBundle(load, applyProposals(load.bundle, [proposal], registry), registry);
  return {
    trial: { proposal: id, base: draft.base, head: levelBundleHash(copy.load), finding: draft.finding, files: proposal.files },
    files: copy.files,
  };
}
